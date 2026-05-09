import prisma from "../../lib/prisma.js"

export const identifyUserDemo = async (req, res, next) => {
    try {
        const demoUserEnv = process.env.DEMO_USER?.split(",").map(email => email.trim()) || [];
        if (demoUserEnv.length === 0) return next();

        const { email: currentUserEmail } = req.validated.body;

        const isDemoUser = demoUserEnv.includes(currentUserEmail);
        if (!isDemoUser) return next();

        const demoUser = await prisma.user.findUnique({
            where: {
                email: currentUserEmail
            }
        });

        if (!demoUser) return res.status(404).json({
            success: false,
            message: "Demo user not found. Please create a new account to continue using the demo."
        });

        const limitTime = 5 * 24 * 60 * 60 * 1000; // 5 days
        const createdAt = new Date(demoUser.createdAt).getTime();

        const isDemoExpired = (Date.now() - createdAt > limitTime);

        if (isDemoExpired) return res.status(403).json({
            success: false,
            message: "Demo user expired. Please create a new account to continue using the demo."
        });

        next();

    } catch (error) {
        console.error("Error identifying demo user:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error while identifying demo user."
        });
    }
}