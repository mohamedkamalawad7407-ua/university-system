import {hash , compare} from "bcrypt"

export const HASH = async(planText: string , SALT_ROUND: number = Number(process.env.SALT_ROUND))=>{
   return hash(planText, SALT_ROUND);
}


export const Compar = async(planText: string , cipherText: string)=>{
   return compare(planText, cipherText);
}