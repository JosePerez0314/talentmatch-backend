import prisma from "../../lib/prisma.js"

export const identifyUserDemo = async (req, res, next) => {
    const users = process.env.DEMO_USER.split(",");

    const demoUsers = [];

    users.forEach(async (user) => {
        const userExists = await prisma.user.findUnique({
            where: {
                email: user
            }, select: {
                createdAt: true
            }
        });
        if (userExists) {
            demoUsers.push(user);
        }

        const date = new Date();
        const demoTime = new Date(date.getTime() - 120 * 60 * 60 * 1000); // 5 days

        if (demoTime > userExists.createdAt) {
            return res.status(403).json({
                success: false,
                message: "Demo trial expired. Please sign up for a full account."
            });
        }
    });
}