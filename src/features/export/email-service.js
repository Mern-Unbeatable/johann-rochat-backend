import nodemailer from 'nodemailer';
import { config } from '../../config/config.js';
import { BadRequestError } from '../../shared/globals/helpers/error-handler.js';

class EmailService {
  async sendEmail(emailTo, generation, html) {
    if (!config.SMTP_HOST || !config.SMTP_USER || !config.SMTP_PASS) {
      throw new BadRequestError('Email service not configured. Please contact support.');
    }

    const transporter = nodemailer.createTransport({
      host: config.SMTP_HOST,
      port: config.SMTP_PORT ?? 587,
      secure: false,
      auth: {
        user: config.SMTP_USER,
        pass: config.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: `"ImmoPro Swiss" <${config.SMTP_FROM ?? config.SMTP_USER}>`,
      to: emailTo,
      subject: `Votre annonce immobilière : ${generation.title}`,
      html,
      text: `${generation.title}\n\n${generation.hook}\n\n${generation.description}`,
    });
  }
}

export default new EmailService();