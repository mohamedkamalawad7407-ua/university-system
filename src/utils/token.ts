import jwt, { JwtPayload } from "jsonwebtoken"
import { AppError } from "./classError"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()




export enum TokenType{
    access = "access",
    refresh = "refresh"
}

export const generateToken = async({payload , signature , options}: {
    payload : Object,
    signature : string, 
    options? : jwt.SignOptions
}) : Promise<string> =>{
    return jwt.sign(payload , signature , options)
}

export const verifyToken = async({token , signature }:{
    token : string,
    signature : string, 
}):Promise <JwtPayload>=>{
    return jwt.verify(token , signature) as JwtPayload
}


export const getSignature = async(tokenType: TokenType) => {
  switch (tokenType) {
    case TokenType.access:
      return process.env.ACCESS_TOKEN!;
    case TokenType.refresh:
      return process.env.REFRESH_TOKEN!;
    default:
      throw new AppError("Invalid token" , 400);
  }
};

export const decodedTokenAndFetchUser = async (token : string , signature : string)=>{
        const decoded = await verifyToken({token , signature })

        if (!decoded) {
            throw new AppError("Invalid token type" , 400);
        }

        let user: any = await prisma.admin.findUnique({ where: { id: decoded.id as string } });
        
        if (user) {
            user.role = "admin";
        } else {
            user = await prisma.student.findUnique({ where: { id: decoded.id as string } });
            if (user) user.role = "student";
        }


        if (!user) {
            throw new AppError("user not exist" , 400);
        }


        if(user?.changCredentials?.getTime()! > decoded?.iat! * 1000){
            throw new AppError("token has been revoke" , 401);
        }

        return { decoded , user }
}