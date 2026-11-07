import app from "./app.ts"

const port = process.env.port || 5000;

app.listen(port, () => {
    console.log("CardVault Server Running!")
})