import { NextResponse } from "next/server";

import { AuthorizationError } from "@/lib/server/authorization/authorization-service";
import { TenantContextError } from "@/lib/server/tenant/tenant-context";

export type ApiResponseBody<T> = {
    code: number;
    data: T;
    msg: string;
};

export function apiSuccess<T>(data: T, msg = "OK", init?: ResponseInit) {
    return NextResponse.json<ApiResponseBody<T>>({ code: 0, data, msg }, init);
}

export function apiOk<T>(data: T, status = 200) {
    return NextResponse.json<ApiResponseBody<T>>({ code: 0, data, msg: "" }, { status });
}

export function apiError(status: number, msg: string, init?: Omit<ResponseInit, "status">): NextResponse<ApiResponseBody<null>>;
export function apiError(error: unknown, fallback: string, event: string): NextResponse<ApiResponseBody<null>>;
export function apiError(statusOrError: unknown, msg: string, initOrEvent?: Omit<ResponseInit, "status"> | string) {
    if (typeof statusOrError === "number") {
        const init = typeof initOrEvent === "string" ? undefined : initOrEvent;
        return NextResponse.json<ApiResponseBody<null>>({ code: statusOrError, data: null, msg }, { ...init, status: statusOrError });
    }

    if (statusOrError instanceof AuthorizationError || statusOrError instanceof TenantContextError) {
        return NextResponse.json<ApiResponseBody<null>>({ code: statusOrError.status, data: null, msg: statusOrError.message }, { status: statusOrError.status });
    }

    console.error(typeof initOrEvent === "string" ? initOrEvent : "API request failed", statusOrError);
    return NextResponse.json<ApiResponseBody<null>>({ code: 500, data: null, msg }, { status: 500 });
}

export function apiCompatError(status: number, msg: string, init?: Omit<ResponseInit, "status">) {
    return NextResponse.json<ApiResponseBody<null> & { error: string }>({ code: status, data: null, msg, error: msg }, { ...init, status });
}
