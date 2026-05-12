import { Response } from "express";

export const sendResponseOr404 = (
  res: Response,
  data: unknown,
  entityName: string = "Record",
) => {
  if (!data) {
    return res.status(404).json({
      success: "false",
      error: `${entityName} not found`,
    });
  }

  return res.status(200).json({
    success: true,
    data: data,
  });
};
