const Category = require('../models/category.model');
const Product = require('../models/product.model');
const { AppError } = require('../middlewares/error.middleware');

/**
 * Create a new category
 * @route POST /api/categories
 */
exports.createCategory = async (req, res, next) => {
  try {
    const { name, description, parent, attributes, image, icon, isActive, metaTitle, metaDescription, metaKeywords } = req.body;

    if (!name) {
      return next(new AppError('Category name is required', 400));
    }

    // Check if category with same name already exists
    const existingCategory = await Category.findOne({ name });
    if (existingCategory) {
      return next(new AppError('Category with this name already exists', 400));
    }

    // If parent category is provided, verify it exists
    let parentCategory;
    let level = 1;
    let path = '';

    if (parent) {
      parentCategory = await Category.findById(parent);
      if (!parentCategory) {
        return next(new AppError('Parent category not found', 404));
      }
      level = parentCategory.level + 1;
      path = parentCategory.path ? `${parentCategory.path},${parent}` : parent;
    }

    // Create new category
    const newCategory = await Category.create({
      name,
      description,
      parent,
      level,
      path,
      attributes: attributes || [],
      image,
      icon,
      isActive: isActive !== undefined ? isActive : true,
      meta: {
        title: metaTitle || name,
        description: metaDescription || description,
        keywords: metaKeywords || []
      },
      createdBy: req.user.id
    });

    res.status(201).json({
      status: 'success',
      data: {
        category: newCategory
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get all categories
 * @route GET /api/categories
 */
exports.getAllCategories = async (req, res, next) => {
  try {
    // Build query
    const queryObj = { ...req.query };
    const excludedFields = ['page', 'sort', 'limit', 'fields'];
    excludedFields.forEach(field => delete queryObj[field]);

    // For public access, only show active categories
    if (!req.user || req.user.role === 'user' || req.user.role === 'seller') {
      queryObj.isActive = true;
    }

    // Advanced filtering
    let queryStr = JSON.stringify(queryObj);
    queryStr = queryStr.replace(/\b(gte|gt|lte|lt)\b/g, match => `$${match}`);

    // Build query
    let query = Category.find(JSON.parse(queryStr));

    // Sorting
    if (req.query.sort) {
      const sortBy = req.query.sort.split(',').join(' ');
      query = query.sort(sortBy);
    } else {
      query = query.sort('level name');
    }

    // Field limiting
    if (req.query.fields) {
      const fields = req.query.fields.split(',').join(' ');
      query = query.select(fields);
    }

    // Pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 100; // Higher limit for categories
    const skip = (page - 1) * limit;

    query = query.skip(skip).limit(limit);

    // Execute query
    const categories = await query;
    const total = await Category.countDocuments(JSON.parse(queryStr));

    res.status(200).json({
      status: 'success',
      results: categories.length,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      data: {
        categories
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get category by ID
 * @route GET /api/categories/:id
 */
exports.getCategory = async (req, res, next) => {
  try {
    const category = await Category.findById(req.params.id);

    if (!category) {
      return next(new AppError('Category not found', 404));
    }

    // For public access, only show active categories
    if ((!req.user || req.user.role === 'user' || req.user.role === 'seller') && !category.isActive) {
      return next(new AppError('Category not found', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        category
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Update category
 * @route PATCH /api/categories/:id
 */
exports.updateCategory = async (req, res, next) => {
  try {
    const category = await Category.findById(req.params.id);

    if (!category) {
      return next(new AppError('Category not found', 404));
    }

    // Filter out fields that are not allowed to be updated
    const filteredBody = {};
    const allowedFields = [
      'name',
      'description',
      'attributes',
      'image',
      'icon',
      'isActive',
      'meta'
    ];
    
    Object.keys(req.body).forEach(key => {
      if (allowedFields.includes(key)) {
        filteredBody[key] = req.body[key];
      }
    });

    // Handle meta fields separately
    if (req.body.metaTitle || req.body.metaDescription || req.body.metaKeywords) {
      filteredBody.meta = { ...category.meta };
      if (req.body.metaTitle) filteredBody.meta.title = req.body.metaTitle;
      if (req.body.metaDescription) filteredBody.meta.description = req.body.metaDescription;
      if (req.body.metaKeywords) filteredBody.meta.keywords = req.body.metaKeywords;
    }

    // Update category
    const updatedCategory = await Category.findByIdAndUpdate(req.params.id, filteredBody, {
      new: true,
      runValidators: true
    });

    res.status(200).json({
      status: 'success',
      data: {
        category: updatedCategory
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Delete category
 * @route DELETE /api/categories/:id
 */
exports.deleteCategory = async (req, res, next) => {
  try {
    const category = await Category.findById(req.params.id);

    if (!category) {
      return next(new AppError('Category not found', 404));
    }

    // Check if category has children
    const childCategories = await Category.find({ parent: req.params.id });
    if (childCategories.length > 0) {
      return next(new AppError('Cannot delete category with subcategories. Please delete subcategories first.', 400));
    }

    // Check if category has products
    const products = await Product.find({ category: req.params.id });
    if (products.length > 0) {
      return next(new AppError('Cannot delete category with products. Please reassign or delete products first.', 400));
    }

    // Delete category
    await Category.findByIdAndDelete(req.params.id);

    res.status(204).json({
      status: 'success',
      data: null
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get category tree
 * @route GET /api/categories/tree
 */
exports.getCategoryTree = async (req, res, next) => {
  try {
    // Get all categories
    const categories = await Category.find(req.user && req.user.role === 'admin' ? {} : { isActive: true })
      .sort('level name');

    // Build tree structure
    const categoryMap = {};
    const rootCategories = [];

    // First pass: create map of categories
    categories.forEach(category => {
      categoryMap[category._id] = {
        ...category.toObject(),
        children: []
      };
    });

    // Second pass: build tree structure
    categories.forEach(category => {
      if (category.parent) {
        // Add to parent's children if parent exists in map
        if (categoryMap[category.parent]) {
          categoryMap[category.parent].children.push(categoryMap[category._id]);
        }
      } else {
        // Root category
        rootCategories.push(categoryMap[category._id]);
      }
    });

    res.status(200).json({
      status: 'success',
      data: {
        categories: rootCategories
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get subcategories
 * @route GET /api/categories/:id/subcategories
 */
exports.getSubcategories = async (req, res, next) => {
  try {
    const category = await Category.findById(req.params.id);

    if (!category) {
      return next(new AppError('Category not found', 404));
    }

    // For public access, only show active categories
    if ((!req.user || req.user.role === 'user' || req.user.role === 'seller') && !category.isActive) {
      return next(new AppError('Category not found', 404));
    }

    // Get subcategories
    const subcategories = await Category.find({
      parent: req.params.id,
      ...((!req.user || req.user.role === 'user' || req.user.role === 'seller') ? { isActive: true } : {})
    }).sort('name');

    res.status(200).json({
      status: 'success',
      results: subcategories.length,
      data: {
        category,
        subcategories
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get category path
 * @route GET /api/categories/:id/path
 */
exports.getCategoryPath = async (req, res, next) => {
  try {
    const category = await Category.findById(req.params.id);

    if (!category) {
      return next(new AppError('Category not found', 404));
    }

    // For public access, only show active categories
    if ((!req.user || req.user.role === 'user' || req.user.role === 'seller') && !category.isActive) {
      return next(new AppError('Category not found', 404));
    }

    // Get category path
    let pathCategories = [];
    
    if (category.path) {
      const categoryIds = category.path.split(',');
      pathCategories = await Category.find({
        _id: { $in: categoryIds },
        ...((!req.user || req.user.role === 'user' || req.user.role === 'seller') ? { isActive: true } : {})
      }).sort('level');
    }

    // Add current category to path
    pathCategories.push(category);

    res.status(200).json({
      status: 'success',
      data: {
        path: pathCategories
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get category products
 * @route GET /api/categories/:id/products
 */
exports.getCategoryProducts = async (req, res, next) => {
  try {
    const category = await Category.findById(req.params.id);

    if (!category) {
      return next(new AppError('Category not found', 404));
    }

    // For public access, only show active categories
    if ((!req.user || req.user.role === 'user' || req.user.role === 'seller') && !category.isActive) {
      return next(new AppError('Category not found', 404));
    }

    // Get all subcategory IDs
    const subcategories = await Category.find({
      $or: [
        { _id: req.params.id },
        { path: { $regex: req.params.id } }
      ],
      ...((!req.user || req.user.role === 'user' || req.user.role === 'seller') ? { isActive: true } : {})
    });

    const categoryIds = subcategories.map(cat => cat._id);

    // Build query for products
    const queryObj = { ...req.query, category: { $in: categoryIds } };
    const excludedFields = ['page', 'sort', 'limit', 'fields', 'search'];
    excludedFields.forEach(field => delete queryObj[field]);

    // For public access, only show active products
    if (!req.user || req.user.role === 'user') {
      queryObj.status = 'active';
    }

    // Filter by price range
    if (req.query.minPrice || req.query.maxPrice) {
      queryObj.price = {};
      if (req.query.minPrice) queryObj.price.$gte = parseFloat(req.query.minPrice);
      if (req.query.maxPrice) queryObj.price.$lte = parseFloat(req.query.maxPrice);
    }

    // Advanced filtering
    let queryStr = JSON.stringify(queryObj);
    queryStr = queryStr.replace(/\b(gte|gt|lte|lt)\b/g, match => `$${match}`);

    // Build base query
    let query = Product.find(JSON.parse(queryStr));

    // Search functionality
    if (req.query.search) {
      query = query.find(
        { $text: { $search: req.query.search } },
        { score: { $meta: 'textScore' } }
      ).sort({ score: { $meta: 'textScore' } });
    }

    // Sorting
    if (req.query.sort) {
      const sortBy = req.query.sort.split(',').join(' ');
      query = query.sort(sortBy);
    } else {
      query = query.sort('-createdAt');
    }

    // Field limiting
    if (req.query.fields) {
      const fields = req.query.fields.split(',').join(' ');
      query = query.select(fields);
    }

    // Pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    query = query.skip(skip).limit(limit);

    // Execute query
    const products = await query.populate('category', 'name').populate('seller', 'businessName logo');
    const total = await Product.countDocuments(JSON.parse(queryStr));

    res.status(200).json({
      status: 'success',
      results: products.length,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      data: {
        category,
        products
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Update category attributes
 * @route PATCH /api/categories/:id/attributes
 */
exports.updateCategoryAttributes = async (req, res, next) => {
  try {
    const { attributes } = req.body;
    
    if (!attributes || !Array.isArray(attributes)) {
      return next(new AppError('Please provide valid attributes array', 400));
    }

    const category = await Category.findById(req.params.id);

    if (!category) {
      return next(new AppError('Category not found', 404));
    }

    // Update attributes
    category.attributes = attributes;
    await category.save();

    res.status(200).json({
      status: 'success',
      data: {
        category
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Move category (change parent)
 * @route PATCH /api/categories/:id/move
 */
exports.moveCategory = async (req, res, next) => {
  try {
    const { newParent } = req.body;
    
    const category = await Category.findById(req.params.id);

    if (!category) {
      return next(new AppError('Category not found', 404));
    }

    // If moving to root
    if (!newParent) {
      category.parent = null;
      category.level = 1;
      category.path = '';
      await category.save();

      // Update all children
      await updateChildrenPath(category._id);

      return res.status(200).json({
        status: 'success',
        data: {
          category
        }
      });
    }

    // Check if new parent exists
    const parentCategory = await Category.findById(newParent);
    if (!parentCategory) {
      return next(new AppError('Parent category not found', 404));
    }

    // Check if new parent is not the category itself or its child
    if (newParent === req.params.id || parentCategory.path?.includes(req.params.id)) {
      return next(new AppError('Cannot move category to itself or its child', 400));
    }

    // Update category
    category.parent = newParent;
    category.level = parentCategory.level + 1;
    category.path = parentCategory.path ? `${parentCategory.path},${newParent}` : newParent;
    await category.save();

    // Update all children
    await updateChildrenPath(category._id);

    res.status(200).json({
      status: 'success',
      data: {
        category
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Helper function to update children paths when a category is moved
 */
async function updateChildrenPath(categoryId) {
  const children = await Category.find({ parent: categoryId });
  
  for (const child of children) {
    const parent = await Category.findById(categoryId);
    
    child.level = parent.level + 1;
    child.path = parent.path ? `${parent.path},${parent._id}` : parent._id.toString();
    await child.save();
    
    // Recursively update grandchildren
    await updateChildrenPath(child._id);
  }
}