export class ValidationError extends Error {
  constructor(message, code = "validation_error") {
    super(message);
    this.name = "ValidationError";
    this.code = code;
    this.status = 400;
  }
}

export class SearchConfigurationError extends Error {
  constructor(message, code = "search_configuration_error") {
    super(message);
    this.name = "SearchConfigurationError";
    this.code = code;
    this.status = 503;
  }
}

export class SearchUpstreamError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "SearchUpstreamError";
    this.code = "search_upstream_error";
    this.status = 502;
    this.details = details;
  }
}

