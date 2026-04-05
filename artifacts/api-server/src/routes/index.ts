import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import antrianRouter from "./antrian";
import adminRouter from "./admin";
import jadwalRouter from "./jadwal";
import nasabahRouter from "./nasabah";
import cabangRouter from "./cabang";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(antrianRouter);
router.use(adminRouter);
router.use(jadwalRouter);
router.use(nasabahRouter);
router.use(cabangRouter);

export default router;
