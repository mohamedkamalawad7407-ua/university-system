import z, { ZodType } from "zod"
import { Request , Response , NextFunction } from "express"
import { AppError } from "../utils/classError"

 
type ReqType = keyof Request
type schemaType = Partial <Record<ReqType,ZodType>>

export const validation = (schema : schemaType)=>{

    return (req:Request,res:Response,next:NextFunction)=>{

       const validationErrors = []
        for(const key of Object.keys(schema) as ReqType[] ){
            if(!schema[key]) continue
        
        const result = schema[key].safeParse(req[key]);
          if (!result.success) {
             validationErrors.push(result.error)
           }
        }
        if(validationErrors.length){
            throw new AppError(JSON.parse(validationErrors as unknown as string))
        }

        next()
        }
}