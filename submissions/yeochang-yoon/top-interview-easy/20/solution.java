class Solution {
    public boolean isValid(String s) {

        Deque<Character> stack = new ArrayDeque<>();

        for(int i = 0; i < s.length(); i++){
            char c = s.charAt(i);

            switch(c){
                case '(' -> stack.push(c);
                case '{' -> stack.push(c);
                case '[' -> stack.push(c);
                case ')' -> {
                    if(stack.isEmpty()){
                        return false;
                    }
                    if(stack.pop() != '('){
                        return false;
                    }
                }
                case '}' -> {
                    if(stack.isEmpty()){
                        return false;
                    }
                    if(stack.pop() != '{'){
                        return false;
                    }
                }
                case ']' -> {
                    if(stack.isEmpty()){
                        return false;
                    }
                    if(stack.pop() != '['){
                        return false;
                    }
                }
            }
        }

        if(stack.isEmpty()){
            return true;
        }

        return false;
    }
}