# CommonBracketObjectNotation
Data-interchange format smaller than json

# Syntax
```cbon
{
  a 1
  b: 'string'
  c = "string"
  d true
  e { }
  f [ 1, 2.5 ]
  g null
  h no_space_str
  i 'Multi
line string'
}
// Multiple documents in one file
{a 1 b 2 c 3}
[ 123_456 1, 2.5 3. .4 5e3 0xaF ]
// [123456, 1, 2.5, 3, 0.4, 5000, 175]
```

- cbon
  ```cbon
  {a 1 b '2' c null d a}
  ```
- json
  ```json
  {"a":1,"b":"2","c":null,"d":"a"}
  ```

```ebnf
object  = '{' [ key [ ':' | '=' ] value [','] ] '}';
array   = '[' [ value [','] ] ']';
key     = word | string;
value   = object | array | string | word | number | 'null' | 'true' | 'false' ;
string  = ("'" anychar "'") | ('"' anychar '"');
word    = any_not_symbol;
```
