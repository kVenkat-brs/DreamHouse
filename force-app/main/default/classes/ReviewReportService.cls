public with sharing class ReviewReportService {
    public class ReportResponse {
        @AuraEnabled public Id contentVersionId;
        @AuraEnabled public String title;
        @AuraEnabled public String downloadUrl;
    }

    @AuraEnabled
    public static ReportResponse generateReport(Id propertyId) {
        if (propertyId == null) {
            throw new AuraHandledException('Property Id is required to generate a report.');
        }
        Property__c property = [
            SELECT Id, Name, City__c, State__c
            FROM Property__c
            WHERE Id = :propertyId
            LIMIT 1
        ];

        List<Property_Review__c> reviews = [
            SELECT Id, Rating__c, Comment__c, CreatedDate, CreatedBy.Name
            FROM Property_Review__c
            WHERE Property__c = :propertyId
            ORDER BY CreatedDate DESC
            LIMIT 50
        ];

        String reportBody = buildReportBody(property, reviews);
        Blob pdfBlob = buildPdf(reportBody);
        ContentVersion version = new ContentVersion(
            Title = property.Name + ' Review Report',
            PathOnClient = property.Name + '_ReviewReport.pdf',
            VersionData = pdfBlob,
            Description = 'Auto-generated review summary report'
        );
        insert version;

        ReportResponse response = new ReportResponse();
        response.contentVersionId = version.Id;
        response.title = version.Title;
        response.downloadUrl = '/sfc/servlet.shepherd/version/download/' + version.Id;
        return response;
    }

    private static Blob buildPdf(String body) {
        String template = '%PDF-1.4\n'
            + '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n'
            + '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n'
            + '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj\n'
            + '4 0 obj << /Length {length} >> stream\n{content}\nendstream endobj\n'
            + '5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n'
            + 'xref\n0 6\n0000000000 65535 f \n'
            + '0000000010 00000 n \n0000000060 00000 n \n0000000114 00000 n \n0000000302 00000 n \n0000000431 00000 n \n'
            + 'trailer << /Size 6 /Root 1 0 R >>\nstartxref\n{startxref}\n%%EOF';

        String text = 'BT /F1 10 Tf 36 750 Td (' + body.escapeCsv().replace(',', '') + ') Tj ET';
        Integer contentLength = text.length();
        String pdf = template
            .replace('{length}', String.valueOf(contentLength))
            .replace('{content}', text)
            .replace('{startxref}', '543');
        return Blob.valueOf(pdf);
    }

    private static String buildReportBody(Property__c property, List<Property_Review__c> reviews) {
        List<String> lines = new List<String>();
        lines.add('Property: ' + property.Name);
        if (!String.isBlank(property.City__c)) {
            lines.add('Location: ' + property.City__c + ', ' + property.State__c);
        }
        lines.add('Total Reviews: ' + reviews.size());
        for (Property_Review__c review : reviews) {
            lines.add('---');
            lines.add('Rating: ' + review.Rating__c);
            lines.add('By: ' + (review.CreatedBy?.Name));
            lines.add('Date: ' + review.CreatedDate);
            if (!String.isBlank(review.Comment__c)) {
                lines.add(review.Comment__c);
            }
        }
        return String.join(lines, '\n');
    }
}
