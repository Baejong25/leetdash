import java.util.*;

class Solution
{
    public int solution(String s)
    {
        Deque<Character> stack = new ArrayDeque<>();
        stack.push(s.charAt(0));

        for(int i = 1; i < s.length(); i++){
            if(!stack.isEmpty() && stack.peek() == s.charAt(i)){
                stack.pop();
                continue;
            }
            stack.push(s.charAt(i));
        }

        if(stack.isEmpty()){
            return 1;
        }

        return 0;
    }
}