export const fakeAuth = (req, res, next) => {
    req.user = { id: 2 };
    next();
};