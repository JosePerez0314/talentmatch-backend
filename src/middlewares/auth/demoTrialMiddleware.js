import prisma from "../../lib/prisma.js"

export const identifyUserDemo = async (req, res, next) => {
    try {
        // 1. Evitar el crash: Si no hay variable en el .env, crea un string vacío
        const demoUsersStr = process.env.DEMO_USER || "";
        if (!demoUsersStr) return next(); // No hay demos configurados, seguimos de largo

        // 2. Limpiar el array para que no haya espacios por error
        const demoUsers = demoUsersStr.split(",").map(email => email.trim());

        // 3. Obtener el email del usuario que está intentando entrar ahora mismo
        const currentEmail = req.body.email;

        // Si la ruta no envía email (ej. un GET) o si el usuario no es parte de los demos, lo dejamos pasar
        if (!currentEmail || !demoUsers.includes(currentEmail)) {
            return next();
        }

        // 4. Validar SOLO al usuario demo que está intentando entrar
        const userExists = await prisma.user.findUnique({
            where: { email: currentEmail },
            select: { createdAt: true }
        });

        if (!userExists) {
            return res.status(404).json({
                success: false,
                message: "Demo user not found. Please sign up for a full account."
            });
        }

        const days = 5 * 24 * 60 * 60 * 1000; // 5 días
        const userDemoTime = new Date(userExists.createdAt).getTime();
        const isExpired = new Date().getTime() - userDemoTime > days;

        if (isExpired) {
            return res.status(403).json({
                success: false,
                message: "Demo trial expired. Please sign up for a full account."
            });
        }

        // Si es demo y aún no expira, lo dejamos pasar al login normal
        next();

    } catch (error) {
        console.error("Error identifying demo user:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error while identifying demo user."
        });
    }
}