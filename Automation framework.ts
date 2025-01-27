import dataSet from 'data-sets/TempManager/Chat/01-Chat-With-Registered-User.dataset.json';
import BrowserManager from 'actions/BrowserManager';
import PageProvider from '__tests__/PageProvider';
import { Browser } from 'playwright';
import MainMenuPage from 'pages/Temp-square/MainMenuPage';
import TempManagerHomePage from 'pages/Temp-manager/transactions/TempManagerHomePage';
import ViewTransactionPage from 'pages/Temp-manager/transactions/ViewTransactionPage';
import ConversationsModal from 'pages/Temp-manager/transactions/ConversationsModal';
import DateCalculator from 'utilities/DateCalculator';
import envProfile from 'data-sets/env-profile';
import ScenarioHelper from 'actions/ScenarioHelper';
import EmailManager from 'utilities/emails/EmailManager';
import LoginApiActions from 'actions/LoginApiActions';
import path from 'path';

describe('Chat with registered users within same enterprise', () => {
    const SCENARIO_LOAD_TIMEOUT: number = envProfile.scenarioLoadTimeOutInMilliSeconds;
    const EMAIL_TIMEOUT_FOR_REGISTERED_USERS: number = envProfile.emailLongTimeOutInMilliSeconds * 2;
    const EMAIL_LONG_TIMEOUT: number = envProfile.emailLongTimeOutInMilliSeconds;
    const EMAIL_BODY_NEW_MESSAGE_NOTIFICATION_TEXT: string = `You have received new messages for transaction #${dataSet.transactionNumber} - ${dataSet.user.companyPublicName} in Tempgram`;
    const MESSAGE_SENDER: string = `${dataSet.user.fullName} (${dataSet.user.company})`;
    const EXPECTED_CHAT_DATE_TIME_REGEX: RegExp = new RegExp(`^${DateCalculator.getCurrentDateAndFormatDDMonthYYYYSeparatedBySpaces()}\\sat\\s\\d+:\\d+\\sUTC$`);

    let browser: Browser;
    let loginApiActions: LoginApiActions;
    let mainMenuPage: MainMenuPage;
    let TempManagerHomePage: TempManagerHomePage;
    let viewTransactionPage: ViewTransactionPage;
    let conversationsModal: ConversationsModal;
    let emailManager: EmailManager;
    let transactionsPageUrl: string;
    let transactionLinkFromEmail: string;
    let allEmailUIDs: string[];
    let emailUIDConversation1: string;
    let emailUIDConversation2: string;

    beforeAll(async () => {
        browser = await BrowserManager.setupBrowser();
        await BrowserManager.setupNewPage(browser);
        loginApiActions = PageProvider.loginApiActions;
        mainMenuPage = PageProvider.mainMenuPage;
        TempManagerHomePage = PageProvider.TempManagerHomePage;
        viewTransactionPage = PageProvider.viewTransactionPage;
        conversationsModal = PageProvider.conversationsModal;
        emailManager = PageProvider.emailManager;
        await ScenarioHelper.loadScenarioIfNeeded(loginApiActions, path.basename(__filename));
    }, SCENARIO_LOAD_TIMEOUT);

    test('Delete all emails', async () => {
        await emailManager.purgeEmailsForAllUsers();

        await expect(emailManager.getEmailCount(dataSet.conversation1.participant.email)).resolves.toBe(0);
    });

    test(`Log in as ${dataSet.user.email} and verify navigation to TempManager home page`, async () => {
        await loginApiActions.signInAndNavigateToTempManagerHomePage(dataSet.user.email);

        await expect(TempManagerHomePage.shouldTempManagerHomePageDisplayed()).resolves.toBeTruthy();
    });

    test('Click on existing Export LC transaction from grid and verify that view transaction page is displayed', async () => {
        await TempManagerHomePage.clickOnTransactionId(dataSet.transactionId);
        await viewTransactionPage.clickOnMaximizeView();

        await expect(viewTransactionPage.waitForViewTransactionPageToBeDisplayed(dataSet.transactionId)).resolves.toBeTruthy();
    });

    test('Verify that chat icon is visible on the bottom right corner', async () =>
        expect(viewTransactionPage.shouldChatIconBeVisible()).resolves.toBeTruthy());

    test('Click on chat icon and verify that new conversations modal is displayed', async () => {
        await viewTransactionPage.clickOnChatIcon();

        await expect(viewTransactionPage.shouldConversationsModalBeDisplayed()).resolves.toBeTruthy();
    });

    describe('Chat with multiple participants:', () => {
        test('Click on New Conversation and verify that conversation content box is displayed', async () => {
            await conversationsModal.clickOnNewConversation();

            await expect(conversationsModal.shouldNewConversationContentBoxBeDisplayed()).resolves.toBeTruthy();
        });

        test(`Enter a Conversation title, add "${dataSet.conversation2.participant1.email}" and "${dataSet.conversation2.participant2.email}" as participant and start conversation`, async () => {
            await conversationsModal.enterConversationTitle(dataSet.conversation2.title);
            await conversationsModal.enterNewParticipant(dataSet.conversation2.participant1.email);
            await conversationsModal.clickOnAddParticipantButton();
            await conversationsModal.enterNewParticipant(dataSet.conversation2.participant2.email);
            await conversationsModal.clickOnAddParticipantButton();
            await conversationsModal.clickOnStartConversationButton();

            await expect(conversationsModal.shouldConversationTitlePresentInConversationsList(dataSet.conversation2.title)).resolves.toBeTruthy();
        });

        test('Click on conversation title and verify that conversation content is displayed', async () => {
            await conversationsModal.clickOnConversationTitle(dataSet.conversation2.title);

            await expect(conversationsModal.shouldConversationContentsModalBeDisplayed()).resolves.toBeTruthy();
        });

        test('Write a message, attach a file and send, verify that a dialog is displayed on chat window', async () => {
            await conversationsModal.typeMessage(dataSet.conversation2.messages.content[0]);
            await conversationsModal.uploadAttachment(`${dataSet.conversation2.messages.attachment.path}${dataSet.conversation2.messages.attachment.fileName}`);
            await conversationsModal.clickOnSendMessageButton({ isAttachment: true, });

            await expect(conversationsModal.getNumberOfDialogsInConversationContentsModal()).resolves.toBe(1);
        });

        test('Verify that message dialog composed of sender information, message date, message and attachment', async () =>
            expect(conversationsModal.getMessageDetailsWithIndex(0)).resolves.toStrictEqual({
                name: MESSAGE_SENDER,
                date: DateCalculator.getDateAndFormatYYYYMMDD({ separator: '/', }),
                time: expect.stringMatching(/^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/),
                text: dataSet.conversation2.messages.content[0],
                attachments: [dataSet.conversation2.messages.attachment.fileName],
            }));
    });

    describe('Chat with single participant', () => {
        beforeAll(async () => conversationsModal.clickOnBackButton());

        test('Click on New Conversation and verify that conversation content box is displayed', async () => {
            await conversationsModal.clickOnNewConversation();

            await expect(conversationsModal.shouldNewConversationContentBoxBeDisplayed()).resolves.toBeTruthy();
        });

        test('Verify "Start Conversation" button is disabled', async () =>
            expect(conversationsModal.shouldStartConversationButtonEnabledOrDisabled({ isEnabled: false, })).resolves.toBeTruthy());

        test('Enter a Conversation title and verify "Start Conversation" button is enabled', async () => {
            await conversationsModal.enterConversationTitle(dataSet.conversation1.title);

            await expect(conversationsModal.shouldStartConversationButtonEnabledOrDisabled({ isEnabled: true, })).resolves.toBeTruthy();
        });

        test(`Enter "${dataSet.conversation1.participant.email}" as participant, click Add button and verify participant added to conversation`, async () => {
            await conversationsModal.enterNewParticipant(dataSet.conversation1.participant.email);
            await conversationsModal.clickOnAddParticipantButton();

            await expect(conversationsModal.getAddedParticipantsList()).resolves.toContain(`${dataSet.conversation1.participant.name} (${dataSet.conversation1.participant.company})`);
        });

        test('Click on "Start Conversation" button and verify that new conversation card has been created', async () => {
            await conversationsModal.clickOnStartConversationButton();

            await expect(conversationsModal.shouldConversationTitlePresentInConversationsList(dataSet.conversation1.title)).resolves.toBeTruthy();
        });

        test(`Click on conversation title "${dataSet.conversation1.title}" and verify that conversation content is displayed`, async () => {
            await conversationsModal.clickOnConversationTitle(dataSet.conversation1.title);

            await expect(conversationsModal.shouldConversationContentsModalBeDisplayed()).resolves.toBeTruthy();
        });

        test('Write a message to text box and click send button and verify that a dialog is displayed on chat window', async () => {
            await conversationsModal.typeMessage(dataSet.conversation1.messages.content[0]);
            await conversationsModal.clickOnSendMessageButton();

            await expect(conversationsModal.getNumberOfDialogsInConversationContentsModal()).resolves.toBe(1);
        });

        test('Verify that message dialog composed of sender information, message date and message', async () => {
            await expect(conversationsModal.getMessageDetailsWithIndex(0)).resolves.toStrictEqual({
                name: MESSAGE_SENDER,
                date: DateCalculator.getDateAndFormatYYYYMMDD({ separator: '/', }),
                time: expect.stringMatching(/^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/),
                text: dataSet.conversation1.messages.content[0],
                attachments: [],
            });
        });

        test('Get current page URL', () => {
            transactionsPageUrl = TempManagerHomePage.getCurrentURL();

            expect(transactionsPageUrl).toMatch(/\/transactions\/\d+$/);
        });
    });

    describe('Check email', () => {
        beforeAll(async () => {
            await emailManager.waitForEmail({ username: dataSet.conversation1.participant.email, }, EMAIL_LONG_TIMEOUT, 2);
            allEmailUIDs = await emailManager.getEmailUIDs(dataSet.conversation1.participant.email);
            emailUIDConversation1 = await emailManager.getUIDWithPartialSubject({ username: dataSet.conversation1.participant.email, }, allEmailUIDs, `New message(s): ${dataSet.user.companyPublicName} #${dataSet.transactionNumber}: ${dataSet.conversation1.title}`);
            emailUIDConversation2 = await emailManager.getUIDWithPartialSubject({ username: dataSet.conversation1.participant.email, }, allEmailUIDs, `New message(s): ${dataSet.user.companyPublicName} #${dataSet.transactionNumber}: ${dataSet.conversation2.title}`);
        }, EMAIL_LONG_TIMEOUT + 5000);

        test(`Verify chat notification email is received by registered user "${dataSet.conversation1.participant.email}"`, async () => {
            await emailManager.waitForEmail({ username: dataSet.conversation1.participant.email, }, EMAIL_TIMEOUT_FOR_REGISTERED_USERS);

            await expect(emailManager.getEmailCount(dataSet.conversation1.participant.email)).resolves.toBeGreaterThan(0);
            await expect(emailManager.getSubjectOfFirstEmail(dataSet.conversation1.participant.email)).resolves.toEqual(expect.stringContaining('New message(s)'));
        }, EMAIL_TIMEOUT_FOR_REGISTERED_USERS);

        test('Verify that email contains a paragraph with transaction number and company name', async () => {
            const mailText: string = await emailManager.getTextInEmailByUID({ username: dataSet.conversation1.participant.email, },
                emailUIDConversation1);

            expect(mailText).toContain(EMAIL_BODY_NEW_MESSAGE_NOTIFICATION_TEXT);
        });

        test(`Verify that email contains conversation title "${dataSet.conversation1.title}" as header`, async () => {
            const mailText: string = await emailManager.getTextInEmailByUID({ username: dataSet.conversation1.participant.email, },
                emailUIDConversation1, {
                    htmlTagToRetrieveTextFrom: 'strong',
                });

            expect(mailText).toContain(`Conversation: ${dataSet.conversation1.title}`);
        });

        describe('Chat messages in emails', () => {
            let conversation1Messages: Array<{ senderName: string; dateAndTime: string; message: string; }>;
            let conversation2Messages: Array<{ senderName: string; dateAndTime: string; message: string; }>;
            const expectedChatMessagesConversation1: Array<[string, number]> = dataSet.conversation1.messages.content.map((message, index) => [message, index]);

            beforeAll(async () => {
                conversation1Messages = await emailManager.getAllChatMessages({ username: dataSet.conversation1.participant.email, }, emailUIDConversation1);
                conversation2Messages = await emailManager.getAllChatMessages({ username: dataSet.conversation1.participant.email, }, emailUIDConversation2);
            });

            test.each(expectedChatMessagesConversation1)(`Verify that message "%s" is displayed with sender info: "${dataSet.user.fullName} (${dataSet.user.companyPublicName})" and date`, (message, index) =>
                expect(conversation1Messages[index]).toMatchObject({
                    senderName: `${dataSet.user.fullName} (${dataSet.user.companyPublicName})`,
                    dateAndTime: expect.stringMatching(EXPECTED_CHAT_DATE_TIME_REGEX),
                    message,
                })
            );

            test(`Verify messages related to ${dataSet.conversation2.title}`, () =>
                expect(conversation2Messages).toMatchObject([{
                    senderName: `${dataSet.user.fullName} (${dataSet.user.companyPublicName})`,
                    dateAndTime: expect.stringMatching(EXPECTED_CHAT_DATE_TIME_REGEX),
                    message: dataSet.conversation2.messages.content.join('\n'),
                }])
            );
        });

        test('Verify chat notification email contains a link to the transaction', async () =>
            emailManager.getTransactionsLinkFromFirstAvailableEmail(dataSet.conversation1.participant.email).then(retrievedTransactionLinkFromEmail => {
                transactionLinkFromEmail = retrievedTransactionLinkFromEmail;
                expect(retrievedTransactionLinkFromEmail).toMatch(/^https:\/\/.+\/transactions\/.+\/verify/i);
            }));
    });

    test(`Sign in as "${dataSet.conversation1.participant.email}" and go to the transaction page using transaction link retrieved from email, verify the sidebar transaction preview page is displayed`, async () => {
        await loginApiActions.signIn(dataSet.conversation1.participant.email);
        await loginApiActions.goToURL(transactionLinkFromEmail);

        await expect(viewTransactionPage.shouldTransactionPreviewSideBarBeDisplayed()).resolves.toBeTruthy();
        await expect(viewTransactionPage.getTransactionId({ isPreview: true, })).resolves.toBe(dataSet.transactionId);
    });

    describe('Check messages from recipient´s account:', () => {
        test(`Log in as ${dataSet.user2.email} and verify navigation to TempManager home page`, async () => {
            await loginApiActions.signInAndVerifyMainMenuPageIsDisplayed(dataSet.user2.email);

            await mainMenuPage.openMenu();
            await mainMenuPage.clickOnTempManagerLink();

            await expect(TempManagerHomePage.shouldTempManagerHomePageDisplayed()).resolves.toBeTruthy();
        });

        test('Verify that "Unread message badge" on top navigation bar is visible and displays "2"', async () => {
            await expect(TempManagerHomePage.shouldTopUnreadMessageBadgeVisible({ timeout: envProfile.emailLongTimeOutInMilliSeconds, })).resolves.toBeTruthy();
            await expect(TempManagerHomePage.getUnreadMessageCount()).resolves.toBe(1);
        });

        test('Verify that transaction number, conversation title and number of unread messages(2) are visible in notification message', async () => {
            await TempManagerHomePage.clickOnTopChatButton();

            await TempManagerHomePage.getUnreadMessageContent().then(unreadMessageRetrieved => {
                expect(unreadMessageRetrieved).toContain(`Transaction #${dataSet.transactionId}`);
                expect(unreadMessageRetrieved).toContain(dataSet.conversation2.title);
                expect(unreadMessageRetrieved.split('\n')[1]).toBe('1');
            });
        });

        test('Verify that "Unread message badge" on top navigation bar is visible and displays "1"', async () => {
            await TempManagerHomePage.clickOnUnreadMessageLink();

            await expect(conversationsModal.shouldConversationContentsModalBeDisplayed()).resolves.toBeTruthy();
        });

        test(`Verify that message sent by ${dataSet.user.email} is visible on chat modal`, async () =>
            expect(conversationsModal.getMessageDetailsWithIndex(0)).resolves.toStrictEqual({
                name: `${dataSet.user.fullName} (${dataSet.user.company})`,
                date: DateCalculator.getDateAndFormatYYYYMMDD({ separator: '/', }),
                time: expect.stringMatching(/^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/),
                text: dataSet.conversation2.messages.content[0],
                attachments: [dataSet.conversation2.messages.attachment.fileName],
            }));
    });

    afterEach(async () => loginApiActions.getScreenshot());

    afterAll(async () => browser.close());
});
