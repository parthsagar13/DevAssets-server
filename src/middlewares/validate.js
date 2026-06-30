const { validationResult } = require('express-validator');
const ApiResponse = require('../utils/response');

const validate = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map(error => ({
      field: error.path,
      message: error.msg,
      value: error.value
    }));

    return ApiResponse.error(res, 'Validation failed', 400, formattedErrors);
  }

  next();
};

module.exports = validate;
