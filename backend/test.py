from openai import OpenAI 
client = OpenAI( base_url="https://janitorai.com/hackathon", api_key="calhacks2047" ) 
completion = client.chat.completions.create( model="x2", 
            messages=[ {"role": "system", "content": "You are a helpful assistant. Return answer in regular text format."}, {"role": "user", "content": "Hello!"} ] )

print(completion[0]['choices'][0]['message']['content'])