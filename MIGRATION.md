# 🚀 Guia de Migração: SQLite para Supabase (PostgreSQL, Auth e Storage)

Este guia orienta o processo de migração do banco de dados SQLite local para o **Supabase** (PostgreSQL em nuvem), além de configurar o **Supabase Auth** para a área administrativa e o **Supabase Storage** para hospedagem pública das imagens dos produtos.

---

## 🗄️ Passo 1: Migração do Banco de Dados (Prisma)

A migração de SQLite para PostgreSQL no Prisma possui algumas particularidades. Como as migrações geradas são escritas em SQL específico para o banco de origem, **você não deve reutilizar a pasta `prisma/migrations` do SQLite no PostgreSQL.**

### Instruções:
1. Crie um projeto no [Supabase](https://supabase.com/).
2. Vá em **Project Settings > Database** e obtenha a **URI de Conexão** (Connection String).
3. No seu arquivo `.env`, comente a linha do SQLite e defina a nova variável (use o modo Session ou Transaction pooling do Supabase, recomendando a porta `5432` ou `6543` dependendo da sua necessidade):
   ```env
   # SQLite Local
   # DATABASE_URL="file:./dev.db"

   # Supabase PostgreSQL
   DATABASE_URL="postgresql://postgres:[SUA-SENHA]@db.[SEU-ID-PROJETO].supabase.co:5432/postgres"
   ```
4. Exclua a pasta de migrações local:
   - Delete a pasta `prisma/migrations/`.
5. No arquivo `prisma/schema.prisma`, mude o `provider` do datasource de `sqlite` para `postgresql`:
   ```prisma
   datasource db {
     provider = "postgresql"
   }
   ```
6. Execute o comando de migração para criar o histórico específico do PostgreSQL:
   ```bash
   npx prisma migrate dev --name init_postgres
   ```
7. Repopule o banco rodando o script de seed novamente:
   ```bash
   npx tsx prisma/seed.ts
   ```

---

## 🔐 Passo 2: Integração com Supabase Auth

Para migrar a autenticação simples baseada em cookies assinados para o **Supabase Auth**, siga estes passos:

1. Instale o SDK do Supabase:
   ```bash
   npm install @supabase/supabase-js
   ```
2. Adicione as credenciais ao seu `.env` (disponíveis em **Project Settings > API** no painel do Supabase):
   ```env
   NEXT_PUBLIC_SUPABASE_URL="https://[SEU-ID-PROJETO].supabase.co"
   NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbG..."
   ```
3. Crie o cliente do Supabase em `src/lib/supabase.ts`:
   ```typescript
   import { createClient } from '@supabase/supabase-js';

   const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
   const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

   export const supabase = createClient(supabaseUrl, supabaseAnonKey);
   ```
4. Substitua a classe de autenticação em `src/services/auth.ts` por uma implementação do Supabase:
   ```typescript
   import { supabase } from '@/lib/supabase';

   export class SupabaseAuthService {
     async login(password: string): Promise<{ success: boolean; error?: string }> {
       // O Supabase Auth geralmente usa email + senha. 
       // Você pode registrar um email fixo (ex: admin@lanchonete.com) no painel do Supabase
       const email = 'admin@lanchonete.com'; 
       
       const { error } = await supabase.auth.signInWithPassword({
         email,
         password,
       });

       if (error) {
         return { success: false, error: 'Credenciais inválidas ou erro no Supabase' };
       }

       return { success: true };
     }

     async logout(): Promise<void> {
       await supabase.auth.signOut();
     }

     async verifySession() {
       const { data: { session } } = await supabase.auth.getSession();
       if (!session) return null;
       return {
         role: 'admin' as const,
         email: session.user.email,
         createdAt: new Date(session.user.created_at).getTime(),
       };
     }
   }

   // Substitua a exportação
   export const authService = new SupabaseAuthService();
   ```

---

## 📷 Passo 3: Armazenamento de Imagens com Supabase Storage

Para armazenar fotos de produtos em nuvem ao invés da pasta local `/uploads/`:

1. No painel do Supabase, vá em **Storage** e crie um bucket público chamado `products`.
2. Certifique-se de definir a política de acesso (Policies) do bucket para permitir:
   - Acesso público de leitura (`SELECT`).
   - Acesso de escrita/upload apenas para usuários autenticados (`INSERT`/`UPDATE` para admin).
3. Na rota de criação/edição de produtos (`src/app/api/admin/products/route.ts`), substitua o salvamento em disco pelo upload no Supabase Storage:
   ```typescript
   import { supabase } from '@/lib/supabase';

   // ... dentro do processamento de imagem ...
   if (image && image.size > 0) {
     const bytes = await image.arrayBuffer();
     const buffer = Buffer.from(bytes);
     
     const filename = `${Date.now()}-${image.name}`;
     
     // Upload para o bucket 'products'
     const { data, error } = await supabase.storage
       .from('products')
       .upload(filename, buffer, {
         contentType: image.type,
         cacheControl: '3600',
         upsert: true
       });

     if (error) throw new Error('Falha no upload da imagem');

     // Obter URL pública
     const { data: { publicUrl } } = supabase.storage
       .from('products')
       .getPublicUrl(filename);

     imageUrl = publicUrl;
   }
   ```

---

## 🚀 Passo 4: Deploy na Vercel

Ao fazer o deploy na Vercel:
1. Conecte seu repositório GitHub.
2. Adicione as variáveis de ambiente em **Project Settings > Environment Variables**:
   - `DATABASE_URL` (do Supabase).
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `ADMIN_PASSWORD` (se mantiver a autenticação local)
3. Adicione o comando de build no `package.json` para rodar a geração do cliente do Prisma:
   ```json
   "scripts": {
     "postinstall": "prisma generate",
     "build": "next build"
   }
   ```
   *Nota: O `postinstall` garante que a Vercel gere o cliente do Prisma automaticamente durante a instalação de dependências.*
