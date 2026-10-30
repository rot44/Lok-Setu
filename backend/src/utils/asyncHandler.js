export const asyncHandler = (requestHandler) => {
    return async (req, res, next) => {
        return Promise.resolve(requestHandler(req, res, next)).catch((err) => {
            if (typeof next === "function") {
                next(err);
            } else {
                throw err;
            }
        });
    };
};
