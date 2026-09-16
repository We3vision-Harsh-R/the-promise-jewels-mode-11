import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

import { env } from "../config/env.js";
import { verifyAccessToken } from "../utils/jwt.js";
import { prisma } from "../database/prisma.js";
import { ApiError } from "../utils/ApiError.js";
import { JwtPayload } from "../modules/auth/auth.types.js";


const authHandler = async (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {

  try {

    let token: string | undefined;


    // ===================================
    // 1. Cookie Authentication
    // ===================================

    if (req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    }


    // ===================================
    // 2. Bearer Token Authentication
    // ===================================

    if (!token && req.headers.authorization) {

      const parts =
        req.headers.authorization.split(" ");


      if (
        parts.length === 2 &&
        parts[0] === "Bearer"
      ) {
        token = parts[1];
      }

    }


    if (!token) {
      throw new ApiError(
        401,
        "Unauthorized",
      );
    }



    // ===================================
    // Verify JWT
    // ===================================

    const payload =
      verifyAccessToken(token);



    // ===================================
    // Check User From Database
    // ===================================

    const user =
      await prisma.user.findUnique({

        where:{
          id: payload.userId,
        },


        select:{
          id:true,
          name:true,
          email:true,
          isActive:true,
        },

      });



    if(!user){

      throw new ApiError(
        401,
        "User not found",
      );

    }



    if(!user.isActive){

      throw new ApiError(
        403,
        "Account disabled",
      );

    }



    req.user = user;
    req.userId = user.id;

    next();


  } catch(error){


    next(
      error instanceof ApiError
        ? error
        : new ApiError(
            401,
            "Invalid or expired access token.",
          ),
    );

  }

};



// New code usage
export const requireAuth = authHandler;


// Friend ke existing modules ke liye
export const authenticate = authHandler;
