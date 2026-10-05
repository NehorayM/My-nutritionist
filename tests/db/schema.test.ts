import { describe, expect, inject, it } from 'vitest'
import './support/context.ts'
import { createAnonClient } from './support/clients.ts'
import { queryLocalDb } from './support/localStack.ts'
import { USER_TABLES } from './support/rows.ts'
import { readSystemFoodIds } from './support/systemFoods.ts'

const { env } = inject('dbTest')
const TABLE_LIST = USER_TABLES.map((table) => `'${table}'`).join(', ')

interface RlsRow {
  table_name: string
  rls_enabled: boolean
}
interface GrantRow {
  table_name: string
  grantee: string
  privileges: string
}
interface PolicyRow {
  tablename: string
  cmd: string
  roles: string
}

describe('database catalog', () => {
  it('has Row Level Security enabled on every user table', () => {
    const rows = queryLocalDb<RlsRow>(
      `select c.relname as table_name, c.relrowsecurity as rls_enabled from pg_class c
       where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' order by 1`,
    )
    expect(rows.map((row) => row.table_name).sort()).toEqual([...USER_TABLES].sort())
    expect(rows.filter((row) => !row.rls_enabled)).toEqual([])
  })

  it('grants anon read access to food_items only and never TRUNCATE to API roles', () => {
    const rows = queryLocalDb<GrantRow>(
      `select table_name, grantee, string_agg(privilege_type, ',' order by privilege_type) as privileges
       from information_schema.role_table_grants
       where table_schema = 'public' and table_name in (${TABLE_LIST})
         and grantee in ('anon', 'authenticated', 'service_role')
       group by table_name, grantee order by table_name, grantee`,
    )
    const byKey = new Map(rows.map((row) => [`${row.table_name}:${row.grantee}`, row.privileges]))
    for (const table of USER_TABLES) {
      expect(byKey.get(`${table}:authenticated`)).toBe('DELETE,INSERT,SELECT,UPDATE')
      expect(byKey.get(`${table}:service_role`)).toBe('DELETE,INSERT,SELECT,UPDATE')
      expect(byKey.get(`${table}:anon`)).toBe(table === 'food_items' ? 'SELECT' : undefined)
    }
  })

  it('defines one policy per table and operation, all scoped to API roles', () => {
    const rows = queryLocalDb<PolicyRow>(
      `select tablename, cmd, array_to_string(roles, ',') as roles from pg_policies
       where schemaname = 'public' order by tablename, cmd, roles`,
    )
    for (const table of USER_TABLES) {
      const commands = rows.filter((row) => row.tablename === table && row.roles === 'authenticated').map((row) => row.cmd)
      expect(commands.sort()).toEqual(['DELETE', 'INSERT', 'SELECT', 'UPDATE'])
    }
    const anonPolicies = rows.filter((row) => row.roles.includes('anon'))
    expect(anonPolicies).toEqual([{ tablename: 'food_items', cmd: 'SELECT', roles: 'anon' }])
    expect(rows.filter((row) => row.roles === 'public')).toEqual([])
  })
})

describe('system food catalog (migration 003)', () => {
  it('is readable without signing in and matches src/data/system-foods.json exactly', async () => {
    const { data, error } = await createAnonClient(env).from('food_items').select('id, source, created_by')
    expect(error).toBeNull()
    const rows = data ?? []
    const expectedIds = readSystemFoodIds()
    expect(expectedIds.length).toBeGreaterThanOrEqual(60)
    expect(rows.map((row) => row.id).sort()).toEqual([...expectedIds].sort())
    expect(rows.every((row) => row.source === 'system' && row.created_by === null)).toBe(true)
  })
})
