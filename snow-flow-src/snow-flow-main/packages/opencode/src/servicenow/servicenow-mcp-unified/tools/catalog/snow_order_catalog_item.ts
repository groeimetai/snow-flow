/**
 * snow_order_catalog_item - Order catalog item
 *
 * Orden de operaciones para evitar race condition con el flow:
 *   1. Obtener definiciones de variables
 *   2. Crear sc_request
 *   3. Pre-crear todos los sc_item_option en paralelo (no necesitan RITM aún)
 *   4. Sleep 1s para garantizar commit en DB
 *   5. Crear sc_req_item (RITM) — el flow arranca AQUÍ
 *   6. Crear sc_item_option_mtom en paralelo inmediatamente
 *   7. Dos PATCHs con sys_mod_count para disparar BRs y asociar flow context
 *      (sys_mod_count es ignorado como valor pero el PATCH es un update real)
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from "../../shared/types.js"
import { getAuthenticatedClient } from "../../shared/auth.js"
import { createSuccessResult, createErrorResult } from "../../shared/error-handler.js"

export const toolDefinition: MCPToolDefinition = {
  name: "snow_order_catalog_item",
  description: "Orders a catalog item programmatically, creating a request (RITM) with specified variable values.",
  category: "itsm",
  subcategory: "service-catalog",
  use_cases: ["ordering", "automation", "ritm"],
  complexity: "intermediate",
  frequency: "high",
  permission: "write",
  allowedRoles: ["developer", "admin"],
  inputSchema: {
    type: "object",
    properties: {
      cat_item: { type: "string", description: "Catalog item sys_id" },
      requested_for: { type: "string", description: "User sys_id or username" },
      variables: { type: "object", description: "Variable name-value pairs" },
      quantity: { type: "number", description: "Quantity to order", default: 1 },
    },
    required: ["cat_item", "requested_for"],
  },
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { cat_item, requested_for, variables = {}, quantity = 1 } = args

  try {
    const client = await getAuthenticatedClient(context)

    // 1. Obtener definiciones de variables ANTES de crear el RITM
    const varDefsResponse = await client.get("/api/now/table/item_option_new", {
      params: {
        sysparm_query: `cat_item=${cat_item}`,
        sysparm_fields: "sys_id,name",
        sysparm_limit: 100,
      },
    })
    const varDefs = varDefsResponse.data.result || []
    const varMap = new Map<string, string>() // name -> sys_id
    varDefs.forEach((def: any) => {
      if (def.name) varMap.set(def.name, def.sys_id)
    })

    // 2. Crear sc_request
    const requestResponse = await client.post("/api/now/table/sc_request", {
      requested_for,
      opened_by: requested_for,
    })
    const requestId = requestResponse.data.result.sys_id

    // 3. Pre-crear sc_item_option records en paralelo (sin RITM todavía)
    const varEntries = Object.entries(variables).filter(([name]) => varMap.has(name))
    const skipped = Object.keys(variables).filter(name => !varMap.has(name))
    if (skipped.length > 0) {
      console.warn(`Variables no encontradas en catálogo: ${skipped.join(', ')}`)
    }

    const optionSysIds: Array<{ optionSysId: string }> = await Promise.all(
      varEntries.map(async ([varName, varValue]) => {
        const defSysId = varMap.get(varName)!
        const optResp = await client.post("/api/now/table/sc_item_option", {
          item_option_new: defSysId,
          value: varValue,
        })
        return { optionSysId: optResp.data.result.sys_id }
      })
    )

    // 4. Esperar para que los sc_item_option estén committed en DB
    await sleep(1000)

    // 5. Crear sc_req_item (RITM) — el flow arranca aquí con variables ya listas
    const ritmResponse = await client.post("/api/now/table/sc_req_item", {
      request: requestId,
      cat_item,
      requested_for,
      quantity,
    })
    const ritmId = ritmResponse.data.result.sys_id
    const ritmNumber = ritmResponse.data.result.number

    // 6. Crear sc_item_option_mtom en paralelo inmediatamente
    await Promise.all(
      optionSysIds.map(({ optionSysId }) =>
        client.post("/api/now/table/sc_item_option_mtom", {
          request_item: ritmId,
          sc_item_option: optionSysId,
        })
      )
    )

    // 7. Dos PATCHs con sys_mod_count para disparar los Business Rules
    //    que asocian el flow context al RITM. El valor es ignorado por
    //    ServiceNow (auto-incrementa), pero el update es real y no deja
    //    rastro visible en la actividad del registro.
    await client.patch(`/api/now/table/sc_req_item/${ritmId}`, { sys_mod_count: '1' })
    await client.patch(`/api/now/table/sc_req_item/${ritmId}`, { sys_mod_count: '1' })

    return createSuccessResult(
      {
        ordered: true,
        request_id: requestId,
        ritm_id: ritmId,
        ritm_number: ritmNumber,
        quantity,
        variables_processed: varEntries.length,
      },
      {
        operation: "order_catalog_item",
        item: cat_item,
        requested_for,
      },
    )
  } catch (error: any) {
    return createErrorResult(error.message)
  }
}

export const version = "4.0.0-pre-create-vars"
export const author = "R5 - pre-create variables before RITM + sys_mod_count trigger"
