import { Collection } from 'mongodb'
import type {
	Adapter,
	DatabaseSession,
	DatabasePerson,
	RegisterDatabasePersonAttributes,
	RegisterDatabaseSessionAttributes
} from 'persontric'
interface PersonDoc extends RegisterDatabasePersonAttributes {
	_id:string;
	__v?:any;
}
interface SessionDoc extends RegisterDatabaseSessionAttributes {
	_id:string;
	__v?:any;
	person_id:string;
	expire_dts:Date;
}
export class MongodbAdapter implements Adapter {
	private Session:Collection<SessionDoc>
	private User:Collection<PersonDoc>
	constructor(Session:Collection<SessionDoc>, User:Collection<PersonDoc>) {
		this.Session = Session
		this.User = User
	}
	public async session__delete(sessionId:string):Promise<void> {
		await this.Session.findOneAndDelete({ _id: sessionId })
	}
	public async person_session_all__delete(person_id:string):Promise<void> {
		await this.Session.deleteMany({ person_id: person_id })
	}
	public async session_person_pair_(
		sessionId:string
	):Promise<[session:DatabaseSession|null, user:DatabasePerson|null]> {
		// await necessary for mongoose
		const cursor = await this.Session.aggregate([
			{ $match: { _id: sessionId } },
			{
				$lookup: {
					from: this.User.collectionName,
					localField: 'person_id',
					// relies on _id being a String, not ObjectId.
					foreignField: '_id',
					as: 'userDocs'
				}
			}
		])
		const sessionUsers = await cursor.toArray()
		const sessionUser = sessionUsers?.at(0) ?? null
		if (!sessionUser) return [null, null]
		const { userDocs, ...sessionDoc } = sessionUser
		const userDoc = userDocs?.at(0) ?? null
		if (!userDoc) return [null, null]
		const session = session_doc__database_session_(sessionDoc as SessionDoc)
		const user = person_doc__database_person_(userDoc)
		return [session, user]
	}
	public async person_session_all_(person_id:string):Promise<DatabaseSession[]> {
		const sessions = await this.Session.find(
			{ person_id: person_id },
			{
				projection: {
					// MongoDB driver doesn't use the extra fields that Mongoose does
					// But, if the dev is passing in mongoose.connection, these fields will be there
					__v: 0,
					_doc: 0
				}
			}
		).toArray()
		return sessions.map((val)=>session_doc__database_session_(val))
	}
	public async session__set(session:DatabaseSession):Promise<void> {
		const value:SessionDoc = {
			_id: session.id,
			person_id: session.person_id,
			expire_dts: session.expire_dts,
			...session.attributes
		}
		await this.Session.insertOne(value)
	}
	public async session_expiration__update(sessionId:string, expire_dts:Date):Promise<void> {
		await this.Session.findOneAndUpdate(
			{ _id: sessionId },
			{ $set: { expire_dts } }
		)
	}
	public async expired_session_all__delete():Promise<void> {
		await this.Session.deleteMany({
			expire_dts: {
				$lte: new Date()
			}
		})
	}
}
function person_doc__database_person_(value:PersonDoc):DatabasePerson {
	delete value.__v
	const { _id: id, ...attributes } = value
	return {
		id,
		attributes
	}
}
function session_doc__database_session_(value:SessionDoc):DatabaseSession {
	delete value.__v
	const { _id: id, person_id, expire_dts, ...attributes } = value
	return {
		id,
		person_id,
		expire_dts,
		attributes
	}
}
