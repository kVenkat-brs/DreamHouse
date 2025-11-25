public with sharing class SharedReviewSessionService {
    public class SessionDTO {
        @AuraEnabled public Id id;
        @AuraEnabled public Id propertyId;
        @AuraEnabled public String status;
        @AuraEnabled public String draftHtml;
        @AuraEnabled public List<ParticipantDTO> participants;
        @AuraEnabled public List<CommentDTO> comments;
    }

    public class ParticipantDTO {
        @AuraEnabled public Id participantId;
        @AuraEnabled public Id userId;
        @AuraEnabled public String name;
        @AuraEnabled public String role;
        @AuraEnabled public Boolean isMe;
    }

    public class CommentDTO {
        @AuraEnabled public Id id;
        @AuraEnabled public Id authorId;
        @AuraEnabled public String authorName;
        @AuraEnabled public String body;
        @AuraEnabled public Datetime createdDate;
    }

    @AuraEnabled
    public static SessionDTO getSession(Id sessionId) {
        Shared_Review_Session__c session = [
            SELECT Id, Property__c, Status__c, Live_Draft__c
            FROM Shared_Review_Session__c
            WHERE Id = :sessionId
            LIMIT 1
        ];
        SessionDTO dto = mapSession(session);
        dto.participants = mapParticipants(session.Id);
        dto.comments = mapComments(session.Id);
        return dto;
    }

    @AuraEnabled
    public static SessionDTO createSession(Id propertyId) {
        if (propertyId == null) {
            throw new AuraHandledException('Property is required to start a session.');
        }
        Shared_Review_Session__c session = new Shared_Review_Session__c(
            Property__c = propertyId,
            Status__c = 'Drafting'
        );
        insert session;

        insert new Shared_Review_Participant__c(
            Session__c = session.Id,
            User__c = UserInfo.getUserId(),
            Role__c = 'Author'
        );

        return getSession(session.Id);
    }

    @AuraEnabled
    public static SessionDTO upsertDraft(Id sessionId, String draftHtml) {
        Shared_Review_Session__c session = [
            SELECT Id, Live_Draft__c
            FROM Shared_Review_Session__c
            WHERE Id = :sessionId
            LIMIT 1
        ];
        session.Live_Draft__c = draftHtml;
        update session;
        return getSession(sessionId);
    }

    @AuraEnabled
    public static SessionDTO addComment(Id sessionId, String body) {
        if (String.isBlank(body)) {
            throw new AuraHandledException('Comment cannot be empty.');
        }

        Shared_Review_Comment__c comment = new Shared_Review_Comment__c(
            Session__c = sessionId,
            Author__c = UserInfo.getUserId(),
            Body__c = body
        );
        insert comment;
        return getSession(sessionId);
    }

    private static SessionDTO mapSession(Shared_Review_Session__c session) {
        SessionDTO dto = new SessionDTO();
        dto.id = session.Id;
        dto.propertyId = session.Property__c;
        dto.status = session.Status__c;
        dto.draftHtml = session.Live_Draft__c;
        return dto;
    }

    private static List<ParticipantDTO> mapParticipants(Id sessionId) {
        List<ParticipantDTO> participants = new List<ParticipantDTO>();
        for (Shared_Review_Participant__c participant : [
            SELECT Id, User__c, Role__c, User__r.Name
            FROM Shared_Review_Participant__c
            WHERE Session__c = :sessionId
        ]) {
            ParticipantDTO dto = new ParticipantDTO();
            dto.participantId = participant.Id;
            dto.userId = participant.User__c;
            dto.role = participant.Role__c;
            dto.name = participant.User__r?.Name;
            dto.isMe = participant.User__c == UserInfo.getUserId();
            participants.add(dto);
        }
        return participants;
    }

    private static List<CommentDTO> mapComments(Id sessionId) {
        List<CommentDTO> comments = new List<CommentDTO>();
        for (Shared_Review_Comment__c comment : [
            SELECT Id, Author__c, Author__r.Name, Body__c, CreatedDate
            FROM Shared_Review_Comment__c
            WHERE Session__c = :sessionId
            ORDER BY CreatedDate ASC
        ]) {
            CommentDTO dto = new CommentDTO();
            dto.id = comment.Id;
            dto.authorId = comment.Author__c;
            dto.authorName = comment.Author__r?.Name;
            dto.body = comment.Body__c;
            dto.createdDate = comment.CreatedDate;
            comments.add(dto);
        }
        return comments;
    }
}
