module.exports = (request, options) => {
  const isRelativeJsImport = /^\.\.?\/.*\.js$/;

  if (isRelativeJsImport.test(request)) {
    const tsRequest = request.replace(/\.js$/, '.ts');

    try {
      return options.defaultResolver(tsRequest, options);
    } catch {
      // Fall back to the default resolution if the TS file doesn't exist.
    }
  }

  return options.defaultResolver(request, options);
};

