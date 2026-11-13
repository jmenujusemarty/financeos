import { apiKeyInput } from "@financeos/core";
import { publicExpenseInput, publicRevenueInput, publicTransactionInput, publicTransactionQuery } from "@financeos/core/contracts/integrations-extra";
import { Body, Controller, Delete, Get, HttpCode, Inject, Param, ParseUUIDPipe, Post, Query, Res, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import type { Response } from "express";
import type { z } from "zod";
import type { WorkspaceContext } from "../../../common/context.js";
import { Ctx, Public, RequireManage, WorkspaceScoped } from "../../../common/guards.js";
import { zod } from "../../../common/zod.js";
import { ApiKeyGuard } from "./api-key.guard.js";
import { ApiKeysService } from "./api-keys.service.js";
import { PublicApiService } from "./public-api.service.js";
import { uploadInterceptor } from "../../storage/files.controller.js";
import { StorageService } from "../../storage/storage.service.js";
import { badRequest } from "../../../common/errors.js";

const uuidParam = new ParseUUIDPipe({ version: "7" });

/** Managing keys: owners and admins only. */
@Controller("api-keys")
@WorkspaceScoped()
@RequireManage()
export class ApiKeysController {
  constructor(@Inject(ApiKeysService) private readonly keys: ApiKeysService) {}

  @Get()
  list(@Ctx() ctx: WorkspaceContext) {
    return this.keys.list(ctx);
  }

  /** Returns the full key once, as `key`. */
  @Post()
  create(@Ctx() ctx: WorkspaceContext, @Body(zod(apiKeyInput)) input: z.output<typeof apiKeyInput>) {
    return this.keys.create(ctx, input);
  }

  @Delete(":id")
  revoke(@Ctx() ctx: WorkspaceContext, @Param("id", uuidParam) id: string) {
    return this.keys.revoke(ctx, id);
  }
}

/** The public API, authenticated by API key: `Authorization: Bearer ew_live_…`. */
@Controller("v1")
@Public()
@UseGuards(ApiKeyGuard)
export class PublicApiController {
  constructor(
    @Inject(PublicApiService) private readonly api: PublicApiService,
    @Inject(ApiKeysService) private readonly keys: ApiKeysService,
    @Inject(StorageService) private readonly storage: StorageService,
  ) {}

  /** Upload an original PDF once; attach the returned id to transactions. Requires write scope. */
  @Post("statement-files")
  @UseInterceptors(uploadInterceptor())
  statementFile(@Ctx() ctx: WorkspaceContext, @UploadedFile() file: Express.Multer.File | undefined) {
    if (!file) throw badRequest("Attach a file in the `file` field");
    return this.storage.saveStatement(ctx, { buffer: file.buffer, filename: file.originalname, contentType: file.mimetype });
  }

  /** The workspaces this key reaches; pick one with X-Workspace-Id (or ?workspace=) on any other call. */
  @Get("workspaces")
  workspaces(@Ctx() ctx: WorkspaceContext) {
    return this.keys.workspacesFor(ctx);
  }

  @Get("accounts")
  accounts(@Ctx() ctx: WorkspaceContext) {
    return this.api.listAccounts(ctx);
  }

  @Get("transactions")
  transactions(@Ctx() ctx: WorkspaceContext, @Query(zod(publicTransactionQuery)) query: z.output<typeof publicTransactionQuery>) {
    return this.api.listTransactions(ctx, query);
  }

  @Post("transactions")
  async createTransaction(
    @Ctx() ctx: WorkspaceContext,
    @Body(zod(publicTransactionInput)) input: z.output<typeof publicTransactionInput>,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.api.createTransaction(ctx, input);
    response.status(result.duplicate ? 200 : 201);
    return result;
  }

  @Post("revenue")
  async revenue(
    @Ctx() ctx: WorkspaceContext,
    @Body(zod(publicRevenueInput)) input: z.output<typeof publicRevenueInput>,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.api.createRevenue(ctx, input);
    response.status(result.duplicate ? 200 : 201);
    return result;
  }

  @Post("expenses")
  async expenses(
    @Ctx() ctx: WorkspaceContext,
    @Body(zod(publicExpenseInput)) input: z.output<typeof publicExpenseInput>,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.api.createExpense(ctx, input);
    response.status(result.duplicate ? 200 : 201);
    return result;
  }

  @Get("summary")
  @HttpCode(200)
  summary(@Ctx() ctx: WorkspaceContext) {
    return this.api.summary(ctx);
  }
}
