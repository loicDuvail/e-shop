const { v4 } = require("uuid");

const Sessions = {
    sessions: [],

    createSession: function (user_id, maxAge) {
        const session = {
            user_id,
            session_id: v4(),
            lifeTime: maxAge,
        };
        this.sessions.push(session);
        return session.session_id;
    },

    killSession: function (session_id, cause) {
        cause ||= "unknown cause";

        const session = this.sessions.find(
            (session) => session.session_id === session_id
        );

        const sessionIndex = this.sessions.indexOf(session);
        this.sessions.splice(sessionIndex, 1);

        const msg = `
        session termiated: ${session_id}
        cause: ${cause}`;
        console.log(msg);
    },

    ageSessions: function (agingIntervalMs) {
        setInterval(() => {
            this.sessions.forEach((session) => {
                session.lifeTime -= agingIntervalMs;
                if (session.lifeTime <= 0)
                    this.killSession(session.session_id), "session timed out";
            });
        }, agingIntervalMs);
    },

    getUserId: function (session_id) {
        const session = this.sessions.find(
            (session) => session.session_id === session_id
        );
        const { user_id } = session;
        return user_id;
    },

    isLoggedIn(session_id) {
        return this.sessions.some(
            (session) => session.session_id === session_id
        );
    },
};

module.exports = Sessions;
