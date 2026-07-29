import java.util.*;

class Solution {
    boolean solution(String s) {

        Deque<Character> stack = new ArrayDeque<>();
        for(int i = 0; i < s.length(); i++){
            char c = s.charAt(i);

            if(c == '('){
                stack.push(')');
            } else{
                if(stack.isEmpty()){
                    return false;
                }
                if(stack.pop() != ')'){
                    return false;
                }
            }
        }

        if(stack.isEmpty()){
            return true;
        }



        return false;
    }
}