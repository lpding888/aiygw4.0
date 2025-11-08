module.exports = (request, options) => {
  const defaultResolver = options.defaultResolver;
  try {
    return defaultResolver(request, options);
  } catch (error) {
    if (request.endsWith('.js')) {
      const tsRequest = request.replace(/\.js$/i, '.ts');
      return defaultResolver(tsRequest, options);
    }
    throw error;
  }
};
