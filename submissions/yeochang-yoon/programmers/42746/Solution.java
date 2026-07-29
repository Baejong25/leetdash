import java.util.*;
import java.io.*;

class Solution {
    public String solution(int[] numbers) {

        String[] strs = new String[numbers.length];

        for(int i = 0; i < numbers.length; i++){
            strs[i] = "" + numbers[i];
        }

        Arrays.sort(strs, (s1, s2) -> {
            int a = Integer.parseInt(s1 + s2);
            int b = Integer.parseInt(s2 + s1);
            if(a > b){
                return -1;
            } else if(a < b){
                return 1;
            } else{
                return 0;
            }
        });
        StringBuilder sb = new StringBuilder();

        for(int i = 0; i < strs.length; i++){
            sb.append(strs[i]);
        }

        String result = sb.toString();
        if(result.startsWith("0")){
            return "0";
        }

        return sb.toString();
    }
}