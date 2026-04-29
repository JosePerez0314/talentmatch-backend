export const validate = (schema) => (req, res, next) => {
    try {
        schema.parse({
            body: req.body,
            params: req.params,
            query: req.query
        });

        return next();
    } catch (error) {
        return next(error);
    }

    return res.status(500).json({
        success: false,
        error: "Internal server error"
    });
};