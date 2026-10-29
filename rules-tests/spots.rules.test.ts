import { readFileSync } from 'node:fs'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import {
  deleteField,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest'

let env: RulesTestEnvironment

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-tideline',
    firestore: { rules: readFileSync('../firestore.rules', 'utf8') },
  })
})

afterAll(async () => {
  await env.cleanup()
})

beforeEach(async () => {
  await env.clearFirestore()
})

describe('users/{uid}', () => {
  test('the owner writes and reads their own list', async () => {
    const alice = env.authenticatedContext('alice').firestore()
    await assertSucceeds(
      setDoc(doc(alice, 'users/alice'), {
        spots: { a: { id: 'a' } },
        order: ['a'],
        updatedAt: serverTimestamp(),
      }),
    )
    await assertSucceeds(getDoc(doc(alice, 'users/alice')))
  })

  test('another user can neither read nor write it', async () => {
    await env.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'users/alice'), {
        spots: {},
        order: [],
        updatedAt: serverTimestamp(),
      })
    })
    const bob = env.authenticatedContext('bob').firestore()
    await assertFails(getDoc(doc(bob, 'users/alice')))
    await assertFails(
      setDoc(doc(bob, 'users/alice'), {
        spots: {},
        order: [],
        updatedAt: serverTimestamp(),
      }),
    )
  })

  test('a signed-out user can neither read nor write it', async () => {
    const anon = env.unauthenticatedContext().firestore()
    await assertFails(getDoc(doc(anon, 'users/alice')))
    await assertFails(
      setDoc(doc(anon, 'users/alice'), {
        spots: {},
        order: [],
        updatedAt: serverTimestamp(),
      }),
    )
  })

  test('a write with another field is refused', async () => {
    const alice = env.authenticatedContext('alice').firestore()
    await assertFails(
      setDoc(doc(alice, 'users/alice'), {
        spots: {},
        order: [],
        updatedAt: serverTimestamp(),
        extra: 1,
      }),
    )
  })

  test('spots must be a map and order a list', async () => {
    const alice = env.authenticatedContext('alice').firestore()
    await assertFails(
      setDoc(doc(alice, 'users/alice'), {
        spots: [{ id: 'a' }],
        order: [],
        updatedAt: serverTimestamp(),
      }),
    )
    await assertFails(
      setDoc(doc(alice, 'users/alice'), {
        spots: {},
        order: 'a',
        updatedAt: serverTimestamp(),
      }),
    )
  })

  test('a merge that sets one spot and deletes another is allowed', async () => {
    const alice = env.authenticatedContext('alice').firestore()
    await setDoc(doc(alice, 'users/alice'), {
      spots: { a: { id: 'a' }, b: { id: 'b' } },
      order: ['a', 'b'],
      updatedAt: serverTimestamp(),
    })
    await assertSucceeds(
      setDoc(
        doc(alice, 'users/alice'),
        {
          spots: { b: deleteField(), c: { id: 'c' } },
          order: ['a', 'c'],
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      ),
    )
    let data: Record<string, unknown> | undefined
    await env.withSecurityRulesDisabled(async (context) => {
      data = (await getDoc(doc(context.firestore(), 'users/alice'))).data()
    })
    expect(data?.spots).toEqual({ a: { id: 'a' }, c: { id: 'c' } })
    expect(data?.order).toEqual(['a', 'c'])
    expect(data?.updatedAt).toBeDefined()
  })

  test('a write with no order is refused', async () => {
    const alice = env.authenticatedContext('alice').firestore()
    await assertFails(
      setDoc(doc(alice, 'users/alice'), {
        spots: { a: { id: 'a' } },
        updatedAt: serverTimestamp(),
      }),
    )
  })

  test('any other path is refused', async () => {
    const alice = env.authenticatedContext('alice').firestore()
    const data = { spots: {}, order: [], updatedAt: serverTimestamp() }
    await assertFails(setDoc(doc(alice, 'users/alice/spots/x'), data))
    await assertFails(setDoc(doc(alice, 'other/alice'), data))
  })
})
