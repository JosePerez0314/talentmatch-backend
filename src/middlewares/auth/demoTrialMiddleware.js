import prisma from "../../lib/prisma.js"

export const identifyUserDemo = async (req, res, next) => {
    try {
        const users = process.env.DEMO_USER.split(",");

        for (const user of users) {
            const userExists = await prisma.user.findUnique({
                where: {
                    email: user
                }, select: {
                    createdAt: true
                }
            });

            if (!userExists) {
                return res.status(404).json({
                    success: false,
                    message: "Demo user not found. Please sign up for a full account."
                });
            }

            const days = 5 * 24 * 60 * 60 * 1000; // 5 days
            const userDemoTime = new Date(userExists.createdAt).getTime();

            const isExpired = new Date() - userDemoTime > days;

            if (isExpired) {
                return res.status(403).json({
                    success: false,
                    message: "Demo trial expired. Please sign up for a full account."
                });
            }
        };

        next();
    } catch (error) {
        console.error("Error identifying demo user:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error while identifying demo user."
        });
    }
}