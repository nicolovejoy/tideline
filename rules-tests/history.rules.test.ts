import { readFileSync } from 'node:fs'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, test } from 'vitest'

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

describe('history/{document=**}', () => {
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore()
      await setDoc(doc(db, 'history/LOX-100-71-KSBA'), { places: 1 })
      await setDoc(doc(db, 'history/LOX-100-71-KSBA/issued/1'), { at: 1 })
    })
  })

  test('an unauthenticated reader can read a place and an issuance', async () => {
    const anon = env.unauthenticatedContext().firestore()
    await assertSucceeds(getDoc(doc(anon, 'history/LOX-100-71-KSBA')))
    await assertSucceeds(getDoc(doc(anon, 'history/LOX-100-71-KSBA/issued/1')))
  })

  test('a signed-in user cannot write a place', async () => {
    const alice = env.authenticatedContext('alice').firestore()
    await assertFails(setDoc(doc(alice, 'history/LOX-100-71-KSBA'), { x: 1 }))
  })

  test('a signed-out user cannot write an issuance', async () => {
    const anon = env.unauthenticatedContext().firestore()
    await assertFails(
      setDoc(doc(anon, 'history/LOX-100-71-KSBA/issued/2'), { at: 2 }),
    )
  })

  test('the users rule is unchanged', async () => {
    await env.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'users/alice'), {
        spots: {},
        order: [],
        updatedAt: serverTimestamp(),
      })
    })
    const alice = env.authenticatedContext('alice').firestore()
    const bob = env.authenticatedContext('bob').firestore()
    await assertSucceeds(getDoc(doc(alice, 'users/alice')))
    await assertFails(getDoc(doc(bob, 'users/alice')))
  })
})
