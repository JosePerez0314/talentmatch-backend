import { z } from 'zod';

export const getOnePositionSchema = z.object({
    params: z.object({
        id: z.coerce.number().int().positive("Invalid Position ID")
    })
});

export const sendPositionSchema = z.object({
    body: z.object({
        role: z.string().min(1, "Role is required"),

        yearsOfExperience: z.coerce.number().int().positive(),

        technicalSkills: z.array(z.string()).min(1),

        optionalTechnicalSkills: z.array(z.string()).optional(),

        softSkills: z.array(z.string()).optional(),

        description: z.string().optional(),

        education: z.string().optional(),

        languages: z.array(z.string()).optional()
    })
});

export const updatePositionSchema = z.object({
    body: z.object({
        role: z.string().min(1, "Role is required"),

        yearsOfExperience: z.coerce.number().int().positive(),

        technicalSkills: z.array(z.string()).min(1),

        optionalTechnicalSkills: z.array(z.string()).optional(),

        softSkills: z.array(z.string()).optional(),

        description: z.string().optional(),

        education: z.string().optional(),

        languages: z.array(z.string()).optional()
    }),

    params: z.object({
        id: z.coerce.number().int().positive("Invalid Position ID")
    })
});

export const deletePositionSchema = z.object({
    params: z.object({
        id: z.coerce.number().int().positive("Invalid position ID")
    })
});

