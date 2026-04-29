export const validate = (schema) => (req, res, next) => {
    try {
        const parsed = schema.parse({
            body: req.body,
            params: req.params,
            query: req.query
        });

        req.validated = parsed

        return next();
    } catch (error) {
        return next(error);
    }

    return res.status(500).json({
        success: false,
        error: "Internal server error"
    });
};