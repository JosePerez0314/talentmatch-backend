import prisma from "../lib/prisma.js"
import { sendResponseOr404 } from "../lib/responseHandler.js"
import { computeMatch } from "../services/computeMatch.js"
import { matchResult } from "./matchResultController.js"

const vacanciesSelectObject = {
    id: true,
    title: true,
    openDate: true,
    closeDate: true,
    createdAt: true,
    status: true
}

const buildVacanciesData = (payload) => {
    return {
        title: payload.title,
        openDate: new Date(payload.openDate),
        closeDate: new Date(payload.closeDate)
    }
}

export const getAllVacancies = async (req, res, next) => {
    const allVacancies = await prisma.vacancy.findMany({
        where: {
            position: {
                userId: req.user.id
            }
        },
        select: {
            ...vacanciesSelectObject
        }
    });

    console.log("USER:", req.user);

    return sendResponseOr404(res, allVacancies, "Vacancies");
}

export const sendVacancies = async (req, res, next) => {
    const payload = req.body;

    if (!payload || Object.keys(payload).length === 0) {
        return res.status(400).json({
            success: false,
            error: "No data provided in the request body"
        });
    }

    if (!payload.title || !payload.positionId || !payload.openDate || !payload.closeDate) {
        return res.status(400).json({
            success: false,
            error: "Missing required fields: 'title', 'openDate', 'closeDate', 'positionId' are mandatory."
        });
    }

    const openDate = new Date(payload.openDate);
    const closeDate = new Date(payload.closeDate);

    if (isNaN(openDate.getTime()) || isNaN(closeDate.getTime())) {
        return res.status(400).json({
            success: false,
            error: "Invalid date format"
        });
    }

    if (openDate >= closeDate) {
        return res.status(400).json({
            success: false,
            error: "openDate must be before closeDate"
        });
    }


    const positionExists = await prisma.position.findFirst({
        where: {
            id: payload.positionId,
            userId: req.user.id
        }
    });

    if (!positionExists) return res.status(404).json({
        success: false,
        message: `Position not found or does not belong to this user`
    });


    const newVacancy = await prisma.vacancy.create({
        data: {
            title: payload.title,
            openDate,
            closeDate,
            positionId: payload.positionId
        },
    });

    const candidates = await prisma.candidate.findMany({
        where: { userId: req.user.id }
    });

    await Promise.all(
        candidates.map(candidate => {
            computeMatch(prisma, newVacancy, candidate);
        })
    )

    console.log("Database write sucessful:", newVacancy.id);
    return res.status(201).json({
        success: true,
        data: newVacancy
    });
}

export const vacancyParam = async (req, res, next, id) => {
    const idSearch = parseInt(id);

    if (isNaN(idSearch)) return res.status(400).json({
        success: false,
        error: "Vacancies IDs only accept numeric values"
    });

    req.idSearch = idSearch;
    next();
}

export const getOneVacancy = async (req, res, next) => {
    const vacancy = await prisma.vacancy.findUnique({
        where: {
            id: req.idSearch,
            position: {
                userId: req.user.id
            }
        },
        select: { ...vacanciesSelectObject }
    });

    return sendResponseOr404(res, vacancy, "Vacancy");
}

export const getVacancyResults = async (req, res, next) => {
    const allMatchResults = await prisma.matchResult.findMany({
        where: {
            vacancyId: req.idSearch,
            vacancy: {
                position: {
                    userId: req.user.id
                }
            }
        },
        orderBy: {
            matchScore: 'desc'
        },
        take: 10,
        select: {
            id: true,
            matchScore: true,
            summary: true,
            redFlags: true,
            hardSkillsScore: true,
            experienceScore: true,
            roleScore: true,
            languagesScore: true,
            educationScore: true,
            softSkillsScore: true,
            candidate: {
                select: {
                    id: true,
                    fullName: true,
                    email: true,
                    fileUrl: true
                }
            }
        }
    });

    return sendResponseOr404(res, allMatchResults, 'Match Results');
}

export const sendVacancyResults = async (req, res, next) => {
    matchResult(req, res, next);
}

export const changeStatus = async (req, res, next) => {
    const { status } = req.body;

    const validStatus = ['OPEN', 'CONTACTING', 'FILLED'];
    if (!status || !validStatus.includes(status)) {
        return res.status(400).json({
            success: false,
            error: "Invalid or missing status. Must be OPEN, CONTACTING, or FILLED"
        });
    }

    const updateVacancy = await prisma.vacancy.update({
        where: {
            id: req.idSearch,
            position: {
                userId: req.user.id
            }
        },
        data: { status: status }
    });

    return sendResponseOr404(res, updateVacancy, "Vacancy Status");
}

export const updateVacancy = async (req, res, next) => {
    const payload = req.body;

    const vacancy = await prisma.vacancy.update({
        where: {
            id: req.idSearch,
            position: {
                userId: req.user.id
            }
        },
        data: {
            ...buildVacanciesData(payload)
        }
    });

    return sendResponseOr404(res, vacancy, "Vacancy");
}

export const deleteVacancy = async (req, res, next) => {
    const vacancy = await prisma.vacancy.delete({
        where: {
            id: req.idSearch,
            position: {
                userId: req.user.id
            }
        }
    })

    return sendResponseOr404(res, vacancy, "Vacancy");
}