import { NextFunction, Request, Response } from "express";
import "../utils/request.type";

import { AppError } from "../utils/classError";

export const authorization = (...accessRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError("Unauthorized", 401));
    }

    if (accessRoles.length === 0) return next();

    const role = req.user.role;
    if (!accessRoles.includes(role)) {
      return next(new AppError("Forbidden", 403));
    }

    return next();
  };
};
