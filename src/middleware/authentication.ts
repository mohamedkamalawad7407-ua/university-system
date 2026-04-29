import { NextFunction, Request, Response  } from "express";
import "../utils/request.type";

import {  decodedTokenAndFetchUser, getSignature, TokenType } from "../utils/token";
import { AppError } from "../utils/classError";


export const authentication = (tokenType : TokenType = TokenType.access)=>{
    return async(req:Request,res:Response,next:NextFunction)=>{
    const {authorization} = req.headers
    
    const [prefix , token] = authorization?.split(" ")  || [] 

    if (!prefix || !token) {
        throw new AppError("token not exist", 400)
    }
    if (prefix.toLowerCase() !== "bearer") {
        throw new AppError("Invalid token prefix", 400)
    }


    const Signature = await getSignature(tokenType)
    if(!Signature){
        throw new AppError("Invalid Signature ", 400)
    }

    const decoded=  await decodedTokenAndFetchUser(token , Signature )
    

    


    
    req.user = decoded.user
    req.decoded = decoded.decoded

    return next()
}
}