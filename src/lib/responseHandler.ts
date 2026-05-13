import { Response } from "express";

type apiResponse<T> = {
  success: boolean;
  data: T;
};

export const sendResponseOr404 = <T>(
  res: Response,
  data: T | null,
  entityName: string = "Record",
) => {
  if (!data) {
    return res.status(404).json({
      success: "false",
      error: `${entityName} not found`,
    });
  }

  const response: apiResponse<T> = {
    success: true,
    data: data,
  };

  return res.status(200).json({ response });
};
