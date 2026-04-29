import prisma from "../lib/prisma.js"
import { sendResponseOr404 } from "../lib/responseHandler.js"
import { computeMatch } from "../services/computeMatchService.js"
import { matchAllCandidatesToVacancy } from "../services/matchingService.js"
import { matchResult } from "./matchResultController.js"

const vacanciesSelectObject = {
    id: true,
    title: true,
    openDate: true,
    closeDate: true,
    createdAt: true,
    status: true
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

    const { title, openDate, closeDate, positionId } = req.validated.body;

    const positionExists = await prisma.position.findFirst({
        where: {
            id: positionId,
            userId: req.user.id
        }
    });

    if (!positionExists) return res.status(404).json({
        success: false,
        message: `Position not found or does not belong to this user`
    });


    const newVacancy = await prisma.vacancy.create({
        data: {
            title,
            openDate,
            closeDate,
            userId: req.user.id,
            positionId
        },
        include: {
            position: true
        }
    });

    await matchAllCandidatesToVacancy(prisma, newVacancy, req.user.id);

    console.log("Database write sucessful:", newVacancy.id);

    return res.status(201).json({
        success: true,
        data: newVacancy
    });
}

export const getOneVacancy = async (req, res, next) => {
    const { id } = req.validated.params;

    const vacancy = await prisma.vacancy.findFirst({
        where: {
            id,
            userId: req.user.id
        },
        select: {
            ...vacanciesSelectObject,
            updatedAt: true,
            positionId: true
        }
    });

    if (!vacancy) {
        return res.status(404).json({
            success: false,
            message: "Vacancy not found or unauthorized"
        });
    }

    return res.status(200).json({
        success: true,
        data: vacancy
    });
};

export const getVacancyResults = async (req, res, next) => {

    const { id } = req.validated.params;

    const allMatchResults = await prisma.matchResult.findMany({
        where: {
            vacancyId: id,
            vacancy: {
                userId: req.user.id
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
            normalizedCandidate: true,
            createdAt: true,
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

export const changeStatus = async (req, res, next) => {
    const { id } = req.validated.params;
    const { status } = req.validated.body;

    const vacancy = await prisma.vacancy.findFirst({
        where: {
            id,
            userId: req.user.id
        }
    });

    if (!vacancy) {
        return res.status(404).json({
            success: false,
            message: "Vacancy not found or unauthorized"
        });
    }

    const updated = await prisma.vacancy.update({
        where: { id },
        data: { status }
    });

    return sendResponseOr404(res, updated, "Vacancy Status");
};

export const updateVacancy = async (req, res, next) => {
    const { id } = req.validated.params;
    const data = req.validated.body;

    const vacancy = await prisma.vacancy.findFirst({
        where: {
            id,
            userId: req.user.id
        }
    });

    if (!vacancy) {
        return res.status(404).json({
            success: false,
            message: "Vacancy not found or unauthorized"
        });
    }

    const updated = await prisma.vacancy.update({
        where: { id },
        data
    });

    return sendResponseOr404(res, updated, "Vacancy");
};

export const deleteVacancy = async (req, res, next) => {
    const { id } = req.validated.params;

    const vacancy = await prisma.vacancy.findFirst({
        where: {
            id,
            userId: req.user.id
        }
    });

    if (!vacancy) {
        return res.status(404).json({
            success: false,
            message: "Vacancy not found or unauthorized"
        });
    }

    await prisma.vacancy.delete({
        where: { id }
    });

    return res.status(200).json({
        success: true,
        message: "Vacancy deleted successfully"
    });
};