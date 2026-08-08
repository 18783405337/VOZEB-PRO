import { postgresQuery, type QueryExecutor, withPostgresTransaction } from "@/lib/server/database/postgres";
import { AuditLogsRepository } from "./audit-log-repository";
import { BillingOrderRepository } from "./billing-order-repository";
import { BillingPaymentRepository } from "./billing-payment-repository";
import { BillingRefundRepository } from "./billing-refund-repository";
import { BillingProductRepository } from "./billing-product-repository";
import { CouponRepository } from "./coupon-repository";
import { PointsWalletRepository } from "./points-wallet-repository";
import { PromotionRepository } from "./promotion-repository";
import { ReferralRepository } from "./referral-repository";
import { WorkPublicationRepository } from "./work-publication-repository";
import { WorkGovernanceRepository } from "./work-governance-repository";
import { WorkCommunityRepository } from "./work-community-repository";
import { AnnouncementsRepository, GenerationLogsRepository, PromptsRepository } from "./content-repository";
import { CdkRepository, EmailCodesRepository, PointsRepository, SessionsRepository, UsersRepository } from "./user-repository";
import { TenantRepository } from "./tenant-repository";
import { AppCenterPostgresRepository } from "./app-center-repository";
import { TenantPowerRepository } from "./tenant-power-repository";
import { TenantSettlementRepository } from "./tenant-settlement-repository";
import { TenantWalletRepository } from "./tenant-wallet-repository";
import type { AppSettingsRecord, EntitlementPlanRecord, JsonValue, SystemModelChannelRecord } from "./repository-shared";
import { isoValue, jsonParam, jsonValue, numberValue, optionalIso, optionalJson, optionalString, stringValue } from "./repository-shared";

export type {
    AuthenticatedUserRecord,
    BillingOrderRecord,
    BillingOrderStatus,
    BillingProductRecord,
    BillingReconciliationRowRecord,
    BillingReconciliationRunRecord,
    CouponRedemptionRecord,
    CouponTemplateRecord,
    JsonValue,
    PaymentTransactionRecord,
    PromotionCampaignRecord,
    PromotionProductRecord,
    ReferralCodeRecord,
    ReferralProgramRecord,
    ReferralRelationshipRecord,
    ReferralRewardRecord,
    ReferralRewardStatus,
    ReferralRiskStatus,
    PublishedWorkAssetRecord,
    PublishedWorkAuthorDisplay,
    PublishedWorkLifecycleStatus,
    PublishedWorkModerationStatus,
    PublishedWorkRecord,
    PublishedWorkSourceType,
    PublishedWorkSummaryRecord,
    PublishedWorkVersionRecord,
    PublishedWorkVisibility,
    PublishedWorkCaseRecord,
    PublishedWorkCaseStatus,
    PublishedWorkCaseSummaryRecord,
    PublishedWorkCaseType,
    PublishedGalleryItemRecord,
    PublishedWorkRankingRecord,
    UserNotificationRecord,
    UserNotificationType,
    WorkCommunityRankingCursor,
    WorkCommunityRankingWindow,
    WorkCommunityRelationResultRecord,
    WorkCommunitySummaryRecord,
    UserFollowResultRecord,
    FollowedUserRecord,
    CommunityUserRecord,
    LikedPublishedWorkRecord,
    PublicCreatorProfileRecord,
    PublicCreatorWorkCursor,
    UserCommunitySummaryRecord,
    UserCouponListItemRecord,
    UserCouponRecord,
    UserSummaryRecord,
    UserPlanAssignmentRecord,
} from "./repository-shared";

export function createPostgresRepositories(executor?: QueryExecutor) {
    const database = executor || { query: postgresQuery };
    const billingProduct = new BillingProductRepository(database);
    const billingOrder = new BillingOrderRepository(database);
    const pointsWallet = new PointsWalletRepository(database);
    const billingPayment = new BillingPaymentRepository(database);
    const billingRefund = new BillingRefundRepository(database);
    const promotion = new PromotionRepository(database);
    const coupons = new CouponRepository(database);

    return {
        settings: new SettingsRepository(database),
        tenants: new TenantRepository(database, executor ? undefined : withPostgresTransaction),
        appCenter: new AppCenterPostgresRepository(database, executor ? undefined : withPostgresTransaction),
        tenantWallet: new TenantWalletRepository(database, executor ? undefined : withPostgresTransaction),
        tenantPower: new TenantPowerRepository(database, executor ? undefined : withPostgresTransaction),
        tenantSettlement: new TenantSettlementRepository(database, executor ? undefined : withPostgresTransaction),
        users: new UsersRepository(database),
        sessions: new SessionsRepository(database),
        emailCodes: new EmailCodesRepository(database),
        points: new PointsRepository(database),
        pointsWallet,
        cdk: new CdkRepository(database),
        announcements: new AnnouncementsRepository(database),
        prompts: new PromptsRepository(database),
        generationLogs: new GenerationLogsRepository(database),
        billing: {
            listProducts: billingProduct.listProducts.bind(billingProduct),
            getProductById: billingProduct.getProductById.bind(billingProduct),
            getProductsByIds: billingProduct.getProductsByIds.bind(billingProduct),
            upsertProduct: billingProduct.upsertProduct.bind(billingProduct),
            updateProduct: billingProduct.updateProduct.bind(billingProduct),
            deleteProductIfUnused: billingProduct.deleteProductIfUnused.bind(billingProduct),
            createOrder: billingOrder.createOrder.bind(billingOrder),
            getOrderById: billingOrder.getOrderById.bind(billingOrder),
            getOrderByOrderNo: billingOrder.getOrderByOrderNo.bind(billingOrder),
            listOrders: billingOrder.listOrders.bind(billingOrder),
            getSummary: billingOrder.getSummary.bind(billingOrder),
            expirePendingOrders: billingOrder.expirePendingOrders.bind(billingOrder),
            updateOrder: billingOrder.updateOrder.bind(billingOrder),
            upsertPayment: billingPayment.upsertPayment.bind(billingPayment),
            updatePaymentState: billingPayment.updatePaymentState.bind(billingPayment),
            listPayments: billingPayment.listPayments.bind(billingPayment),
            lockPaymentIdentity: billingPayment.lockPaymentIdentity.bind(billingPayment),
            getPaymentByProviderIdentifiers: billingPayment.getPaymentByProviderIdentifiers.bind(billingPayment),
            getPaymentByProviderIdentifier: billingPayment.getPaymentByProviderIdentifier.bind(billingPayment),
            createReconciliationRun: billingPayment.createReconciliationRun.bind(billingPayment),
            getReconciliationRunByFileHash: billingPayment.getReconciliationRunByFileHash.bind(billingPayment),
            listReconciliationRuns: billingPayment.listReconciliationRuns.bind(billingPayment),
            getReconciliationRun: billingPayment.getReconciliationRun.bind(billingPayment),
            listReconciliationRows: billingPayment.listReconciliationRows.bind(billingPayment),
            createPlanAssignment: billingPayment.createPlanAssignment.bind(billingPayment),
            getActivePlanAssignment: billingPayment.getActivePlanAssignment.bind(billingPayment),
            listPlanAssignments: billingPayment.listPlanAssignments.bind(billingPayment),
            updatePlanAssignment: billingPayment.updatePlanAssignment.bind(billingPayment),
            upsertProviderEvent: billingPayment.upsertProviderEvent.bind(billingPayment),
            getProviderEventByProviderEventId: billingPayment.getProviderEventByProviderEventId.bind(billingPayment),
            claimProviderEvent: billingPayment.claimProviderEvent.bind(billingPayment),
            markProviderEventProcessed: billingPayment.markProviderEventProcessed.bind(billingPayment),
            markProviderEventConflict: billingPayment.markProviderEventConflict.bind(billingPayment),
            releaseProviderEvent: billingPayment.releaseProviderEvent.bind(billingPayment),
            getRefundJobByOrderId: billingRefund.getByOrderId.bind(billingRefund),
            upsertRefundJob: billingRefund.upsert.bind(billingRefund),
            claimDueRefundJobs: billingRefund.claimDue.bind(billingRefund),
            checkpointRefundJob: billingRefund.checkpoint.bind(billingRefund),
            releaseRefundJob: billingRefund.release.bind(billingRefund),
        },
        promotions: promotion,
        coupons,
        referrals: new ReferralRepository(database),
        workPublications: new WorkPublicationRepository(database),
        workGovernance: new WorkGovernanceRepository(database),
        workCommunity: new WorkCommunityRepository(database),
        auditLogs: new AuditLogsRepository(database),
    };
}

class SettingsRepository {
    constructor(private readonly db: QueryExecutor) {}

    async lock() {
        await this.db.query("SELECT id FROM app_settings WHERE id = 'default' FOR UPDATE");
    }

    async getPaymentConfig() {
        const result = await this.db.query("SELECT payment_config FROM app_settings WHERE id = 'default'");
        return result.rows[0] ? jsonValue(result.rows[0].payment_config) : {};
    }

    async getSettings() {
        const [settings, plans, channels] = await Promise.all([this.db.query("SELECT * FROM app_settings WHERE id = 'default'"), this.listEntitlementPlans(), this.listSystemModelChannels()]);
        return {
            settings: settings.rows[0] ? mapSettings(settings.rows[0]) : undefined,
            plans,
            channels,
        };
    }

    async getWalletSettings() {
        const [settings, plans] = await Promise.all([this.db.query("SELECT * FROM app_settings WHERE id = 'default'"), this.listEntitlementPlans()]);
        return {
            settings: settings.rows[0] ? mapSettings(settings.rows[0]) : undefined,
            plans,
        };
    }

    async updateSettings(input: Partial<Omit<AppSettingsRecord, "id" | "createdAt" | "updatedAt">>) {
        const row = await this.db.query(
            `
            UPDATE app_settings SET
                site = COALESCE($1, site),
                registration_enabled = COALESCE($2, registration_enabled),
                email_registration_enabled = COALESCE($3, email_registration_enabled),
                free_daily_points_enabled = COALESCE($4, free_daily_points_enabled),
                mail = COALESCE($5, mail),
                allow_user_api_config = COALESCE($6, allow_user_api_config),
                model_point_costs = COALESCE($7, model_point_costs),
                generation_point_multipliers = COALESCE($8, generation_point_multipliers),
                entitlements_enabled = COALESCE($9, entitlements_enabled),
                default_plan_id = COALESCE($10, default_plan_id),
                generation_concurrency = COALESCE($11, generation_concurrency),
                generation_defaults = COALESCE($12, generation_defaults),
                payment_config = COALESCE($13, payment_config),
                logical_models = COALESCE($14, logical_models),
                default_models = COALESCE($15, default_models),
                agent_skills = COALESCE($16, agent_skills),
                free_daily_points = COALESCE($17, free_daily_points)
            WHERE id = 'default'
            RETURNING *
            `,
            [
                jsonParam(input.site),
                input.registrationEnabled,
                input.emailRegistrationEnabled,
                input.freeDailyPointsEnabled,
                jsonParam(input.mail),
                input.allowUserApiConfig,
                jsonParam(input.modelPointCosts),
                jsonParam(input.generationPointMultipliers),
                input.entitlementsEnabled,
                input.defaultPlanId,
                jsonParam(input.generationConcurrency),
                jsonParam(input.generationDefaults),
                jsonParam(input.paymentConfig),
                jsonParam(input.logicalModels),
                jsonParam(input.defaultModels),
                jsonParam(input.agentSkills),
                input.freeDailyPoints,
            ],
        );
        return mapSettings(row.rows[0]);
    }

    async listEntitlementPlans() {
        const result = await this.db.query("SELECT * FROM entitlement_plans ORDER BY sort_order ASC, created_at ASC");
        return result.rows.map(mapEntitlementPlan);
    }

    async upsertEntitlementPlan(plan: Omit<EntitlementPlanRecord, "createdAt" | "updatedAt">) {
        const result = await this.db.query(
            `
            INSERT INTO entitlement_plans (id, name, enabled, daily_points, limits, features, sort_order)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                enabled = EXCLUDED.enabled,
                daily_points = EXCLUDED.daily_points,
                limits = EXCLUDED.limits,
                features = EXCLUDED.features,
                sort_order = EXCLUDED.sort_order
            RETURNING *
            `,
            [plan.id, plan.name, plan.enabled, plan.dailyPoints, jsonParam(plan.limits), jsonParam(plan.features), plan.sortOrder],
        );
        return mapEntitlementPlan(result.rows[0]);
    }

    async removeEntitlementPlansNotIn(ids: string[]) {
        await this.db.query(
            `DELETE FROM entitlement_plans AS plans
             WHERE plans.id <> ALL($1::text[])
               AND NOT EXISTS (SELECT 1 FROM users WHERE users.plan_id = plans.id)
               AND NOT EXISTS (SELECT 1 FROM user_plan_assignments WHERE user_plan_assignments.plan_id = plans.id)`,
            [ids],
        );
        const remaining = await this.db.query("SELECT id FROM entitlement_plans WHERE id <> ALL($1::text[]) ORDER BY id", [ids]);
        return remaining.rows.map((row) => stringValue(row.id));
    }

    async listSystemModelChannels() {
        const result = await this.db.query("SELECT * FROM system_model_channels ORDER BY sort_order ASC, created_at ASC");
        return result.rows.map(mapSystemModelChannel);
    }

    async getSystemModelChannelById(id: string, forUpdate = false) {
        const result = await this.db.query(`SELECT * FROM system_model_channels WHERE id = $1${forUpdate ? " FOR UPDATE" : ""}`, [id]);
        return result.rows[0] ? mapSystemModelChannel(result.rows[0]) : null;
    }

    async upsertSystemModelChannel(channel: Omit<SystemModelChannelRecord, "createdAt" | "updatedAt">) {
        const result = await this.db.query(
            `
            INSERT INTO system_model_channels (id, name, base_url, api_key_ciphertext, webhook_secret_ciphertext, api_format, models, enabled, advanced_config, sort_order)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                base_url = EXCLUDED.base_url,
                api_key_ciphertext = EXCLUDED.api_key_ciphertext,
                webhook_secret_ciphertext = EXCLUDED.webhook_secret_ciphertext,
                api_format = EXCLUDED.api_format,
                models = EXCLUDED.models,
                enabled = EXCLUDED.enabled,
                advanced_config = EXCLUDED.advanced_config,
                sort_order = EXCLUDED.sort_order
            RETURNING *
            `,
            [channel.id, channel.name, channel.baseUrl, channel.apiKeyCiphertext, channel.webhookSecretCiphertext, channel.apiFormat, jsonParam(channel.models), channel.enabled, jsonParam(channel.advancedConfig), channel.sortOrder],
        );
        return mapSystemModelChannel(result.rows[0]);
    }

    async deleteSystemModelChannelsNotIn(ids: string[]) {
        const result = await this.db.query("DELETE FROM system_model_channels WHERE id <> ALL($1::text[])", [ids]);
        return result.rowCount || 0;
    }
}

function mapSettings(row: Record<string, unknown>): AppSettingsRecord {
    return {
        id: "default",
        site: jsonValue(row.site),
        registrationEnabled: row.registration_enabled !== false,
        emailRegistrationEnabled: row.email_registration_enabled === true,
        freeDailyPointsEnabled: row.free_daily_points_enabled !== false,
        freeDailyPoints: numberValue(row.free_daily_points),
        mail: jsonValue(row.mail),
        allowUserApiConfig: row.allow_user_api_config === true,
        modelPointCosts: jsonValue(row.model_point_costs),
        generationPointMultipliers: jsonValue(row.generation_point_multipliers),
        entitlementsEnabled: row.entitlements_enabled === true,
        defaultPlanId: stringValue(row.default_plan_id),
        generationConcurrency: jsonValue(row.generation_concurrency),
        generationDefaults: jsonValue(row.generation_defaults),
        paymentConfig: jsonValue(row.payment_config),
        logicalModels: jsonValue(row.logical_models),
        defaultModels: jsonValue(row.default_models),
        agentSkills: jsonValue(row.agent_skills),
        createdAt: isoValue(row.created_at),
        updatedAt: isoValue(row.updated_at),
    };
}

function mapEntitlementPlan(row: Record<string, unknown>): EntitlementPlanRecord {
    return {
        id: stringValue(row.id),
        name: stringValue(row.name),
        enabled: row.enabled !== false,
        dailyPoints: numberValue(row.daily_points),
        limits: jsonValue(row.limits),
        features: jsonValue(row.features),
        sortOrder: numberValue(row.sort_order),
        createdAt: isoValue(row.created_at),
        updatedAt: isoValue(row.updated_at),
    };
}

function mapSystemModelChannel(row: Record<string, unknown>): SystemModelChannelRecord {
    return {
        id: stringValue(row.id),
        name: stringValue(row.name),
        baseUrl: stringValue(row.base_url),
        apiKeyCiphertext: stringValue(row.api_key_ciphertext),
        webhookSecretCiphertext: stringValue(row.webhook_secret_ciphertext),
        apiFormat: row.api_format === "gemini" ? "gemini" : "openai",
        models: jsonValue(row.models),
        enabled: row.enabled !== false,
        advancedConfig: optionalJson(row.advanced_config),
        sortOrder: numberValue(row.sort_order),
        createdAt: isoValue(row.created_at),
        updatedAt: isoValue(row.updated_at),
    };
}
