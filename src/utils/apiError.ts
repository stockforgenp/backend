export class ApiError extends Error {
  public statusCode: number;
  public isOperational: boolean;
  public errors?: any[];

  constructor(
    statusCode: number,
    message: string,
    errors?: any[],
    isOperational = true,
    stack = "",
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.errors = errors;

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  static badRequest(message = "Bad Request", errors?: any[]): ApiError {
    return new ApiError(400, message, errors);
  }

  static unauthorized(message = "Unauthorized", errors?: any[]): ApiError {
    return new ApiError(401, message, errors);
  }

  static forbidden(message = "Forbidden", errors?: any[]): ApiError {
    return new ApiError(403, message, errors);
  }

  static notFound(message = "Resource Not Found", errors?: any[]): ApiError {
    return new ApiError(404, message, errors);
  }

  static conflict(
    message = "Resource already exists",
    errors?: any[],
  ): ApiError {
    return new ApiError(409, message, errors);
  }

  static unprocessableEntity(
    message = "Validation Error",
    errors?: any[],
  ): ApiError {
    return new ApiError(422, message, errors);
  }

  static internal(message = "Internal Server Error"): ApiError {
    return new ApiError(500, message, undefined, false);
  }
}
