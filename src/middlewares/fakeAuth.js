export const fakeAuth = (req, res, next) => {
    req.user = { id: 1 };
    next();
};