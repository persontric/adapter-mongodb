import { database_person, test_adapter } from '@persontric/adapter-test'
import dotenv from 'dotenv'
import { Collection, MongoClient } from 'mongodb'
import { resolve } from 'path'
import { MongodbAdapter } from '../index.js'
dotenv.config({ path: `${resolve()}/.env` })
const client = new MongoClient(process.env.MONGODB_URL!)
await client.connect()
const db = client.db('lucia-test')
const User = db.collection('users') as Collection<any>
const Session = db.collection('sessions') as Collection<any>
const adapter = new MongodbAdapter(Session, User)
await User.deleteMany({})
await Session.deleteMany({})
await User.insertOne({
	_id: database_person.id,
	login: database_person.attributes.login
})
await test_adapter(adapter)
await User.deleteMany({})
await Session.deleteMany({})
process.exit(0)
declare module 'persontric' {
	interface Register {
		DatabasePersonAttributes:{
			login:string;
		};
	}
}
