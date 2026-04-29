import z from "zod"

export const signupAdminSchema = {
    body : z.object({
    email: z
    .string()
    .trim()
    .toLowerCase()
    .email("invalid email format"),
    password : z.string().regex(/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[a-zA-Z]).{8,}$/),

}).required()
}

export const signinAdminSchema = {
    body :z.object({
    email: z
    .string()
    .trim()
    .toLowerCase()
    .email("invalid email format"),
    password : z.string().regex(/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[a-zA-Z]).{8,}$/),
}).required()
}



// export const logoutSchema = {
//     body : z.object({
//     flag : z.enum(flagType)
// }).required()
// }

export type signinAdminSchemaType = z.infer<typeof signinAdminSchema.body >
export type signupAdminSchemaType = z.infer<typeof signupAdminSchema.body >
