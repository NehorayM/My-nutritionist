import { describe, expect, it, vi } from 'vitest'
import { createEmailSender, parseAddress, RESEND_DEFAULT_FROM, RESEND_ENDPOINT } from '../../../../supabase/functions/reminders/sender.ts'
import { EmailError, type EmailMessage } from '../../../../supabase/functions/reminders/types.ts'

const MESSAGE: EmailMessage = { to: 'noa@example.com', subject: 'Hi', text: 'Hello', html: '<p>Hello</p>', headers: { 'List-Unsubscribe': '<x>' }, idempotencyKey: 'reminder-1' }
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

describe('email senders', () => {
  it('Resend: posts the message with the API key and idempotency key', async () => {
    const fetchImpl = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(async () => reply({ id: 'resend-1' }))
    const sender = createEmailSender({ resendApiKey: 're_test', mailpitUrl: 'http://mailpit:8025', from: null }, fetchImpl)
    expect(sender?.name).toBe('resend')
    expect(await sender?.send(MESSAGE)).toEqual({ id: 'resend-1' })
    const [url, init] = fetchImpl.mock.calls[0] ?? []
    expect(url).toBe(RESEND_ENDPOINT)
    expect(init?.headers).toMatchObject({ Authorization: 'Bearer re_test', 'Idempotency-Key': 'reminder-1' })
    expect(JSON.parse(String(init?.body))).toMatchObject({ from: RESEND_DEFAULT_FROM, to: ['noa@example.com'], subject: 'Hi', headers: MESSAGE.headers })
  })

  it('Mailpit: uses its send API with a structured sender', async () => {
    const fetchImpl = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(async () => reply({ ID: 'mp-1' }))
    const sender = createEmailSender({ resendApiKey: null, mailpitUrl: 'http://mailpit:8025', from: 'Team <team@example.org>' }, fetchImpl)
    expect(await sender?.send(MESSAGE)).toEqual({ id: 'mp-1' })
    expect(fetchImpl.mock.calls[0]?.[0]).toBe('http://mailpit:8025/api/v1/send')
    expect(JSON.parse(String(fetchImpl.mock.calls[0]?.[1].body))).toMatchObject({ From: { Email: 'team@example.org', Name: 'Team' }, To: [{ Email: 'noa@example.com' }] })
  })

  it('no provider configured → no sender', () => {
    expect(createEmailSender({ resendApiKey: null, mailpitUrl: null, from: null }, vi.fn<(url: string, init: RequestInit) => Promise<Response>>())).toBeNull()
  })

  it.each([
    [429, true],
    [503, true],
    [403, false],
    [422, false],
  ])('classifies HTTP %s as retryable = %s', async (status, retryable) => {
    const sender = createEmailSender({ resendApiKey: 're_test', mailpitUrl: null, from: null }, async () => reply({ message: 'no' }, status))
    const error = await sender?.send(MESSAGE).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(EmailError)
    expect((error as EmailError).retryable).toBe(retryable)
  })

  it('treats network failures as retryable', async () => {
    const sender = createEmailSender({ resendApiKey: 're_test', mailpitUrl: null, from: null }, async () => {
      throw new TypeError('fetch failed')
    })
    await expect(sender?.send(MESSAGE)).rejects.toMatchObject({ retryable: true })
  })

  it('parses sender addresses', () => {
    expect(parseAddress('My App <a@b.co>')).toEqual({ name: 'My App', email: 'a@b.co' })
    expect(parseAddress(' a@b.co ')).toEqual({ name: null, email: 'a@b.co' })
  })
})
